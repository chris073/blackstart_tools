"""
Minimal test server: listens on 127.0.0.1:4712 and sends lines of 12 floats
(va, va_rad, vb, vb_rad, vc, vc_rad, ia, ia_rad, ib, ib_rad, ic, ic_rad)
so you can run the synchrophasor P,Q,S GUI against it.
"""
import socket
import math
import time

HOST = "127.0.0.1"
PORT = 4712


def main():
    # Sample phasors: V in V, I in A, angles in rad (roughly -30 deg for current)
    va, vb, vc = 230e3, 230e3, 230e3  # 230 kV
    va_rad, vb_rad, vc_rad = 0.0, -2.094, 2.094  # 0, -120°, 120° in rad
    ia, ib, ic = 500.0, 500.0, 500.0
    ia_rad = math.radians(-30)
    ib_rad = math.radians(-150)
    ic_rad = math.radians(90)

    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server.bind((HOST, PORT))
    server.listen(1)
    print(f"Test server listening on {HOST}:{PORT}. Run the GUI and click Connect.")

    while True:
        conn, addr = server.accept()
        print(f"Client connected from {addr}")
        try:
            with conn:
                t = 0
                while True:
                    # Slight variation over time
                    phase_shift = 0.02 * math.sin(t * 0.1)
                    line = (
                        f"{va},{va_rad + phase_shift},{vb},{vb_rad + phase_shift},{vc},{vc_rad + phase_shift},"
                        f"{ia},{ia_rad + phase_shift},{ib},{ib_rad + phase_shift},{ic},{ic_rad + phase_shift}\n"
                    )
                    conn.send(line.encode("utf-8"))
                    t += 1
                    time.sleep(0.5)
        except (ConnectionResetError, BrokenPipeError):
            print("Client disconnected.")
        except KeyboardInterrupt:
            break

    server.close()


if __name__ == "__main__":
    main()
