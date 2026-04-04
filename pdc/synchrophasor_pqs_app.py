"""
FreeSimpleGUI app: connect to IP:port, capture synchrophasor va,va_rad,vb,vb_rad,vc,vc_rad,
ia,ia_rad,ib,ib_rad,ic,ic_rad; compute P, Q, S; show live updating output.
Expects TCP stream of lines with 12 floats (CSV or space-separated): va, va_rad, vb, vb_rad,
vc, vc_rad, ia, ia_rad, ib, ib_rad, ic, ic_rad.
"""
import socket
import threading
import math
import FreeSimpleGUI as sg

# Event key for thread -> GUI updates
PHASOR_UPDATE_EVENT = "-PHASOR-UPDATE-"


def calc_pqs(va, va_rad, vb, vb_rad, vc, vc_rad, ia, ia_rad, ib, ib_rad, ic, ic_rad):
    """
    Angles in radians. Per phase: phi = theta_v - theta_i,
    P = V*I*cos(phi), Q = V*I*sin(phi). Total P, Q = sum of phases; S = sqrt(P^2 + Q^2).
    Returns (P_W, Q_Var, S_VA).
    """
    phi_a = va_rad - ia_rad
    phi_b = vb_rad - ib_rad
    phi_c = vc_rad - ic_rad
    P_a = va * ia * math.cos(phi_a)
    Q_a = va * ia * math.sin(phi_a)
    P_b = vb * ib * math.cos(phi_b)
    Q_b = vb * ib * math.sin(phi_b)
    P_c = vc * ic * math.cos(phi_c)
    Q_c = vc * ic * math.sin(phi_c)
    P_total = P_a + P_b + P_c
    Q_total = Q_a + Q_b + Q_c
    S_total = math.sqrt(P_total**2 + Q_total**2)
    return P_total, Q_total, S_total


def parse_phasor_line(line):
    """Parse a line of 12 floats (comma or space separated). Returns list of 12 or None."""
    line = line.strip()
    if not line or line.startswith("#"):
        return None
    parts = line.replace(",", " ").split()
    if len(parts) != 12:
        return None
    try:
        return [float(x) for x in parts]
    except ValueError:
        return None


def reader_thread(sock, window):
    """Read lines from socket and send phasor updates to the GUI."""
    try:
        filelike = sock.makefile(mode="r", encoding="utf-8", errors="replace")
        while True:
            line = filelike.readline()
            if not line:
                break
            row = parse_phasor_line(line)
            if row is not None:
                try:
                    P, Q, S = calc_pqs(
                        row[0], row[1], row[2], row[3], row[4], row[5],
                        row[6], row[7], row[8], row[9], row[10], row[11],
                    )
                    window.write_event_value(
                        PHASOR_UPDATE_EVENT,
                        {
                            "va": row[0], "va_rad": row[1], "vb": row[2], "vb_rad": row[3],
                            "vc": row[4], "vc_rad": row[5], "ia": row[6], "ia_rad": row[7],
                            "ib": row[8], "ib_rad": row[9], "ic": row[10], "ic_rad": row[11],
                            "P": P, "Q": Q, "S": S,
                        },
                    )
                except (ValueError, IndexError):
                    pass
    except (ConnectionResetError, BrokenPipeError, OSError):
        window.write_event_value(PHASOR_UPDATE_EVENT, {"error": "Connection closed."})
    except Exception as e:
        window.write_event_value(PHASOR_UPDATE_EVENT, {"error": str(e)})
    finally:
        try:
            sock.close()
        except Exception:
            pass


def build_output_text(data):
    """Format one update for the output multiline."""
    if "error" in data:
        return f"[Error] {data['error']}\n"
    lines = [
        "--- Phasors ---",
        f"  Va = {data['va']:.4f} V,  angle = {data['va_rad']:.4f} rad",
        f"  Vb = {data['vb']:.4f} V,  angle = {data['vb_rad']:.4f} rad",
        f"  Vc = {data['vc']:.4f} V,  angle = {data['vc_rad']:.4f} rad",
        f"  Ia = {data['ia']:.4f} A,  angle = {data['ia_rad']:.4f} rad",
        f"  Ib = {data['ib']:.4f} A,  angle = {data['ib_rad']:.4f} rad",
        f"  Ic = {data['ic']:.4f} A,  angle = {data['ic_rad']:.4f} rad",
        "--- Power ---",
        f"  P = {data['P']:.2f} W   ({data['P']/1e6:.4f} MW)",
        f"  Q = {data['Q']:.2f} Var ({data['Q']/1e6:.4f} MVar)",
        f"  S = {data['S']:.2f} VA  ({data['S']/1e6:.4f} MVA)",
        "",
    ]
    return "\n".join(lines) + "\n"


def main():
    layout = [
        [
            sg.Text("IP:", size=(4, 1)),
            sg.Input("127.0.0.1", key="-IP-", size=(18, 1)),
            sg.Text("Port:", size=(4, 1)),
            sg.Input("4712", key="-PORT-", size=(8, 1)),
            sg.Button("Connect", key="-CONNECT-"),
            sg.Button("Disconnect", key="-DISCONNECT-", disabled=True),
            sg.Button("Clear", key="-CLEAR-"),
        ],
        [sg.HorizontalSeparator()],
        [
            sg.Multiline(
                "",
                key="-OUT-",
                size=(70, 22),
                font=("Consolas", 10),
                autoscroll=True,
                write_only=True,
            ),
        ],
        [sg.StatusBar("Ready. Enter IP and port, then Connect.", key="-STATUS-")],
    ]

    window = sg.Window("Synchrophasor P, Q, S Monitor", layout, finalize=True)
    reader = None
    sock = None

    while True:
        event, values = window.read()
        if event == sg.WIN_CLOSED:
            break

        if event == "-CONNECT-":
            ip = (values.get("-IP-") or "").strip() or "127.0.0.1"
            try:
                port = int((values.get("-PORT-") or "4712").strip())
            except ValueError:
                sg.popup_error("Port must be a number.", title="Error")
                continue
            window["-STATUS-"].update("Connecting...")
            window["-CONNECT-"].update(disabled=True)
            try:
                s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                s.settimeout(10.0)
                s.connect((ip, port))
                s.settimeout(None)
                sock = s
                window["-OUT-"].print(f"Connected to {ip}:{port}\n")
                window["-STATUS-"].update("Connected. Receiving phasor data...")
                window["-DISCONNECT-"].update(disabled=False)
                reader = threading.Thread(target=reader_thread, args=(s, window), daemon=True)
                reader.start()
            except Exception as e:
                window["-STATUS-"].update("Ready.")
                window["-CONNECT-"].update(disabled=False)
                sg.popup_error(f"Connection failed: {e}", title="Error")

        elif event == "-DISCONNECT-":
            if sock:
                try:
                    sock.close()
                except Exception:
                    pass
                sock = None
            window["-DISCONNECT-"].update(disabled=True)
            window["-CONNECT-"].update(disabled=False)
            window["-STATUS-"].update("Disconnected.")
            window["-OUT-"].print("Disconnected.\n")

        elif event == "-CLEAR-":
            window["-OUT-"].update("")

        elif event == PHASOR_UPDATE_EVENT:
            data = values.get(event)
            if data is None:
                continue
            if "error" in data:
                window["-OUT-"].print(build_output_text(data))
                window["-STATUS-"].update("Connection closed.")
                window["-DISCONNECT-"].update(disabled=True)
                window["-CONNECT-"].update(disabled=False)
            else:
                window["-OUT-"].print(build_output_text(data))

    if sock:
        try:
            sock.close()
        except Exception:
            pass
    window.close()


if __name__ == "__main__":
    main()
