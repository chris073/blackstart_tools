"""
TCC (Time-Characteristic) Curve App using FreeSimpleGUI.
X-axis: time (ms). Y-axis: user-defined (e.g. Frequency). Step curves per device with legend.
"""
import json
import math
import FreeSimpleGUI as sg

# Default time extent (s) for x-axis; stored/used as ms in graph
DEFAULT_T_MIN_S = 0.0
DEFAULT_T_MAX_S = 10.0

# Graph size; legend is in a separate panel to the right
GRAPH_SIZE = (600, 400)
MAX_LEGEND_ENTRIES = 20
PLOT_BACKGROUNDS = {
    "White": "#ffffff",
    "Light gray": "#e8e8e8",
    "Light blue": "#e6f2ff",
    "Cream": "#fff8e7",
}
GRIDLINE_COLOR = "#cccccc"

# 8 colors users can choose per device (name -> hex)
DEVICE_COLOR_CHOICES = [
    ("Blue", "#1e88e5"),
    ("Orange", "#ff9800"),
    ("Green", "#43a047"),
    ("Red", "#e53935"),
    ("Purple", "#8e24aa"),
    ("Teal", "#00897b"),
    ("Navy", "#3949ab"),
    ("Amber", "#ffb300"),
]
DEVICE_COLOR_HEX = dict(DEVICE_COLOR_CHOICES)
DEVICE_COLOR_NAMES = [name for name, _ in DEVICE_COLOR_CHOICES]
HEX_TO_COLOR_NAME = {hex_val: name for name, hex_val in DEVICE_COLOR_CHOICES}
DEFAULT_DEVICE_COLOR = DEVICE_COLOR_CHOICES[0][1]

# Fixed Y-axis options (not configurable)
Y_AXIS_OPTIONS = ["Current", "Voltage", "Frequency"]
# Y-axis label (vertical text next to axis)
Y_AXIS_DISPLAY_LABELS = {
    "Frequency": "Frequency",
    "Voltage": "Voltage pu",
    "Current": "Current",
}
# Default graph title (top of plot) per axis
GRAPH_TITLE_DEFAULTS = {
    "Frequency": "Frequency Coordination",
    "Voltage": "Voltage Coordination",
    "Current": "Current Coordination",
}

# Shared devices; each axis has a unique table per device.
# shared_devices = [device_name, ...]
# y_axes[axis_name] = { "device_tables": { device_name: [(pickup, time_ms), ...] } }
# device_colors[device_name] = hex color string
shared_devices = []
y_axes = {}
device_colors = {}
current_y_name = None
current_device_name = None


def ensure_y_axes():
    """Ensure the three fixed axes exist."""
    for name in Y_AXIS_OPTIONS:
        if name not in y_axes:
            y_axes[name] = {"device_tables": {}}


def get_or_create_y_axis(name):
    ensure_y_axes()
    if name not in y_axes:
        y_axes[name] = {"device_tables": {}}
    return y_axes[name]


def get_device_points(y_name, device_name):
    """Table for this (dimension, device). Unique per Y-axis; device list is shared."""
    ax = get_or_create_y_axis(y_name)
    if device_name not in ax["device_tables"]:
        ax["device_tables"][device_name] = []
    return ax["device_tables"][device_name]


def get_device_color(device_name):
    """Return hex color for device; assign default if not set."""
    if device_name not in device_colors:
        used = set(device_colors.values())
        for name, hex_val in DEVICE_COLOR_CHOICES:
            if hex_val not in used:
                device_colors[device_name] = hex_val
                break
        else:
            device_colors[device_name] = DEFAULT_DEVICE_COLOR
    return device_colors[device_name]


def export_to_json():
    """Build a JSON-serializable dict of shared_devices and y_axes (points as [p, t] lists)."""
    axes_data = {}
    for dim_name, ax in y_axes.items():
        tables = {}
        for dev_name, points in ax.get("device_tables", {}).items():
            tables[dev_name] = [[float(p), int(t)] for p, t in points]
        axes_data[dim_name] = {"device_tables": tables}
    return {
        "shared_devices": list(shared_devices),
        "y_axes": axes_data,
        "device_colors": dict(device_colors),
    }


def load_from_json(data):
    """Load shared_devices, y_axes, device_colors from a dict (from JSON)."""
    global shared_devices, y_axes, device_colors
    shared_devices[:] = data.get("shared_devices", [])
    device_colors.clear()
    device_colors.update(data.get("device_colors", {}))
    y_axes.clear()
    ensure_y_axes()
    for axis_name in Y_AXIS_OPTIONS:
        ax_data = data.get("y_axes", {}).get(axis_name)
        if not ax_data:
            continue
        for dev_name, points in ax_data.get("device_tables", {}).items():
            y_axes[axis_name]["device_tables"][dev_name] = [(float(p), int(t)) for p, t in points]


def get_clipboard_text(window):
    """Get clipboard text (for Paste rows). Returns empty string if unavailable."""
    try:
        root = getattr(window, "TKRoot", None) or getattr(window, "root", None)
        if root is not None:
            return root.clipboard_get()
    except Exception:
        pass
    return ""


def parse_pasted_rows(text):
    """Parse pasted text into list of (pickup, time_ms). Lines: 'pickup time' or 'pickup,time' or 'pickup\ttime'."""
    rows = []
    for line in (text or "").strip().splitlines():
        line = line.strip()
        if not line:
            continue
        parts = line.replace(",", "\t").split()
        if len(parts) >= 2:
            try:
                p = float(parts[0].strip())
                s = float(parts[1].strip())
                if s >= 0:
                    rows.append((p, int(round(s * 1000))))
            except (ValueError, TypeError):
                continue
    return rows


def parse_comma_separated_pickup_time(pickup_str, time_str):
    """
    Parse Pickup (Y) and Time (s) inputs; accept comma-separated values.
    Returns list of (pickup, time_ms). If no commas, returns single-item list or empty.
    """
    pickup_str = (pickup_str or "").strip()
    time_str = (time_str or "").strip()
    if not pickup_str and not time_str:
        return []
    pickups = [x.strip() for x in pickup_str.split(",") if x.strip()]
    times_s = [x.strip() for x in time_str.split(",") if x.strip()]
    if not pickups and not times_s:
        return []
    # Single value: use as one point (allow one field empty -> 0)
    if len(pickups) <= 1 and len(times_s) <= 1:
        try:
            p = float(pickups[0]) if pickups else 0.0
            s = float(times_s[0]) if times_s else 0.0
            if s >= 0:
                return [(p, int(round(s * 1000)))]
        except (ValueError, TypeError):
            return []
    # Multiple values: pair up by index (same length or trim to shorter)
    n = min(len(pickups), len(times_s))
    if n == 0:
        return []
    out = []
    for i in range(n):
        try:
            p = float(pickups[i].strip())
            s = float(times_s[i].strip())
            if s >= 0:
                out.append((p, int(round(s * 1000))))
        except (ValueError, TypeError):
            continue
    return out


def build_points_table(values_list):
    """Build table rows: Pickup, Time (s) with 2 decimal places. Internal t is ms."""
    return [[str(p), f"{t/1000:.2f}"] for p, t in sorted(values_list, key=lambda x: x[1])]


def parse_table_rows(rows):
    """Parse table rows: second column is Time (s), convert to time_ms."""
    out = []
    for row in rows:
        if len(row) >= 2:
            try:
                p = float(row[0].strip())
                s = float(row[1].strip())
                if s >= 0:
                    t = int(round(s * 1000))
                    out.append((p, t))
            except (ValueError, TypeError):
                pass
    return sorted(out, key=lambda x: x[1])


def _choose_tick_values(v_min, v_max, max_ticks=8):
    """Pick roughly max_ticks tick values between v_min and v_max."""
    span = v_max - v_min
    if span <= 0:
        return [v_min]
    n = min(max_ticks, max(2, int(span) + 1))
    step = span / (n - 1) if n > 1 else span
    return [v_min + i * step for i in range(n)]


def _choose_time_ticks_ms(t_min_ms, t_max_ms):
    """X-axis ticks: at most 5 labels between min and max, step in multiples of 10 s."""
    span_ms = t_max_ms - t_min_ms
    if span_ms <= 0:
        return [t_min_ms]
    # At most 5 ticks -> 4 gaps; step rounded up to multiple of 10 s (10000 ms)
    step_ms = max(10000, ((span_ms + 3) // 4 + 9999) // 10000 * 10000)
    ticks = [t_min_ms + i * step_ms for i in range(5) if t_min_ms + i * step_ms <= t_max_ms]
    if not ticks:
        ticks = [t_min_ms, t_max_ms]
    return ticks


def _log10_x(t_ms):
    """Map time (ms) to log10 scale for X-axis; log10(t+1) so t=0 is valid."""
    return math.log10(t_ms + 1)


def _choose_log_time_ticks_ms(t_min_ms, t_max_ms):
    """Ticks for log X-axis: nice values 1,2,5 * 10^k ms that fall in [t_min, t_max]."""
    if t_max_ms <= 0:
        return [max(1, t_min_ms)]
    # Nice values in ms: 1, 2, 5, 10, 20, 50, 100, ...
    ticks = []
    for exp in range(0, 20):
        for m in (1, 2, 5):
            t = m * (10 ** exp)
            if t_min_ms <= t <= t_max_ms:
                ticks.append(t)
    if t_min_ms <= 0 and 0 not in ticks:
        ticks.insert(0, 0)
    ticks.sort()
    # Include bounds if not already present
    if ticks and t_min_ms < ticks[0] and t_min_ms >= 0:
        ticks.insert(0, max(0, t_min_ms))
    if ticks and t_max_ms > ticks[-1]:
        ticks.append(t_max_ms)
    # Limit to ~8 ticks for readability
    if len(ticks) > 8:
        step = max(1, len(ticks) // 8)
        ticks = [ticks[i] for i in range(0, len(ticks), step)]
        if ticks[-1] != t_max_ms:
            ticks.append(t_max_ms)
    return ticks if ticks else [t_min_ms, t_max_ms]


# Short line for legend (about length of two hyphens), no highlight
LEGEND_LINE_TEXT = "——"


def _draw_legend_panel(window, device_list):
    """Update the legend: short colored line (vertically centered) + device name, no highlight."""
    for i in range(MAX_LEGEND_ENTRIES):
        line_key = f"-LEGEND_LINE_{i}-"
        name_key = f"-LEGEND_NAME_{i}-"
        if i < len(device_list):
            name = device_list[i]
            color = get_device_color(name)
            try:
                window[line_key].update(LEGEND_LINE_TEXT, text_color=color, visible=True)
                window[name_key].update(name, visible=True)
            except Exception:
                window[line_key].update(LEGEND_LINE_TEXT, visible=True)
                window[name_key].update(name, visible=True)
        else:
            try:
                window[line_key].update("", visible=False)
                window[name_key].update("", visible=False)
            except Exception:
                pass


def draw_tcc_curve(graph, t_min, t_max, y_name, title="", x_label="", y_label="",
                   show_tickmarks=True, show_gridlines=False, plot_background_key="White",
                   y_min=None, y_max=None, x_log_scale=False):
    """Draw step curves (overlay). Returns (t_min, t_max, y_lo, y_hi) or None."""
    graph.Erase()
    ax = y_axes.get(y_name)
    if not ax:
        graph.DrawText("No dimension to plot", (t_min + (t_max - t_min) / 2, 0), font=("Helvetica", 12))
        return None
    # X in graph coords: linear t or log10(t+1)
    def to_x(t):
        return _log10_x(t) if x_log_scale else t
    # Only plot devices that have at least one point for this dimension
    device_tables = ax.get("device_tables", {})
    devices_to_plot = {d: device_tables.get(d, []) for d in shared_devices if device_tables.get(d)}
    if not devices_to_plot:
        graph.DrawText("No devices to plot", (t_min + (t_max - t_min) / 2, 0), font=("Helvetica", 12))
        return None

    devices = devices_to_plot
    all_y = []
    for points in devices.values():
        for p, _ in points:
            all_y.append(p)
    if not all_y:
        graph.DrawText("No points to plot", (t_min + (t_max - t_min) / 2, 0), font=("Helvetica", 12))
        return None

    # Nominal reference: Frequency 60, Voltage 1.0 (used for vertical lead-in from nominal to first pickup)
    nominal = {"Frequency": 60, "Voltage": 1.0}.get(y_name)

    y_lo = y_min if y_min is not None else min(all_y)
    y_hi = y_max if y_max is not None else max(all_y)
    if nominal is not None:
        y_lo = min(y_lo, nominal)
        y_hi = max(y_hi, nominal)
    if y_hi == y_lo:
        y_lo -= 1
        y_hi += 1
    padding = (y_hi - y_lo) * 0.05 or 1
    y_lo -= padding
    y_hi += padding
    # Frequency: ensure Y-axis extends at least 1 Hz above the largest value
    if y_name == "Frequency":
        y_hi = max(y_hi, max(all_y) + 1)

    x_min = to_x(t_min)
    x_max = to_x(t_max)
    x_span = x_max - x_min
    t_span = t_max - t_min
    y_span = y_hi - y_lo
    # Larger left/bottom margins so tick labels don't collide with the plot
    margin_left = x_span * 0.18
    margin_right = x_span * 0.03
    margin_bottom = y_span * 0.18
    margin_top = y_span * 0.12

    graph_left = x_min - margin_left
    graph_right = x_max + margin_right
    graph_bottom = y_lo - margin_bottom
    graph_top = y_hi + margin_top
    graph.change_coordinates((graph_left, graph_bottom), (graph_right, graph_top))

    center_x = (x_min + x_max) / 2
    center_y = (y_lo + y_hi) / 2

    # Plot area background (different from canvas background)
    fill_color = PLOT_BACKGROUNDS.get(plot_background_key, PLOT_BACKGROUNDS["White"])
    graph.DrawRectangle((x_min, y_lo), (x_max, y_hi), fill_color=fill_color, line_color=GRIDLINE_COLOR)

    # Gridlines (inside plot area only)
    time_ticks = _choose_log_time_ticks_ms(t_min, t_max) if x_log_scale else _choose_time_ticks_ms(t_min, t_max)
    if show_gridlines:
        for t in time_ticks:
            x = to_x(t)
            if x > x_min and x < x_max:
                graph.DrawLine((x, y_lo), (x, y_hi), color=GRIDLINE_COLOR, width=1)
        for y in _choose_tick_values(y_lo, y_hi):
            if y > y_lo and y < y_hi:
                graph.DrawLine((x_min, y), (x_max, y), color=GRIDLINE_COLOR, width=1)

    if title:
        graph.DrawText(title, (center_x, graph_top - 0.5 * margin_top), font=("Helvetica", 12, "bold"))
    if x_label:
        graph.DrawText(x_label, (center_x, graph_bottom + 0.18 * margin_bottom), font=("Helvetica", 10))
    if y_label:
        # Draw Y-axis label vertically, shifted left so it doesn't collide with y-axis tick labels
        y_font = ("Helvetica", 10)
        char_spacing = y_span * 0.035
        x_pos = graph_left + 0.12 * margin_left
        n = len(y_label)
        for i, ch in enumerate(y_label):
            y_pos = center_y + (n / 2 - i - 0.5) * char_spacing
            graph.DrawText(ch, (x_pos, y_pos), font=y_font)

    if show_tickmarks:
        tick_len_x = x_span * 0.012
        tick_len_y = y_span * 0.02
        tick_font = ("Helvetica", 8)
        x_label_y = y_lo - 0.45 * margin_bottom
        for t in time_ticks:
            x = to_x(t)
            graph.DrawLine((x, y_lo), (x, y_lo - tick_len_y), color="black", width=1)
            # Label: time in seconds; use decimals for small values when log scale
            s = t / 1000.0
            if x_log_scale and (s < 1 or s != int(s)):
                label = str(round(s, 3)) if s < 0.01 else (str(round(s, 2)) if s < 0.1 else str(round(s, 1)))
            else:
                label = str(int(t // 1000))
            graph.DrawText(label, (x, x_label_y), font=tick_font)
        y_label_x = x_min - 0.55 * margin_left
        for y in _choose_tick_values(y_lo, y_hi):
            graph.DrawLine((x_min, y), (x_min - tick_len_x, y), color="black", width=1)
            graph.DrawText(str(round(y, 2)), (y_label_x, y), font=tick_font)

    device_list = list(devices.keys())

    # Overlay: all device curves on the same axes (use chosen device color). Clip to [t_min, t_max].
    for device_name in device_list:
        color = get_device_color(device_name)
        points = sorted(devices[device_name], key=lambda x: x[1])
        if not points:
            continue

        t_prev, y_prev = points[0][1], points[0][0]
        for i in range(len(points)):
            t_cur, y_cur = points[i][1], points[i][0]
            t_end = points[i + 1][1] if i + 1 < len(points) else t_max
            # Clip segment times to x-axis range so we don't draw outside it
            t_cur_c = max(t_min, min(t_max, t_cur))
            t_end_c = max(t_min, min(t_max, t_end))
            x_cur, x_end = to_x(t_cur), to_x(t_end)
            x_cur_c, x_end_c = to_x(t_cur_c), to_x(t_end_c)
            if i == 0:
                if nominal is not None:
                    # Vertical to first pickup only if first point is within x-axis range (no nominal horizontal)
                    if t_min <= t_cur <= t_max:
                        if y_cur > nominal:
                            graph.DrawLine((x_cur_c, y_hi), (x_cur_c, y_cur), color=color, width=2)
                        else:
                            graph.DrawLine((x_cur_c, y_lo), (x_cur_c, y_cur), color=color, width=2)
                # First horizontal segment: clip to [t_min, t_max]
                if t_cur_c < t_end_c:
                    graph.DrawLine((x_cur_c, y_cur), (x_end_c, y_cur), color=color, width=2)
            else:
                # Vertical step only if this point is within x-axis range
                if t_min <= t_cur <= t_max:
                    graph.DrawLine((x_cur_c, y_prev), (x_cur_c, y_cur), color=color, width=2)
                if t_cur_c < t_end_c:
                    graph.DrawLine((x_cur_c, y_cur), (x_end_c, y_cur), color=color, width=2)
            t_prev, y_prev = t_cur, y_cur

    return (t_min, t_max, y_lo, y_hi)


def make_left_column():
    return [
        [sg.Text("X-axis extent (s)")],
        [sg.Input(str(DEFAULT_T_MIN_S), key="-TMIN-", size=(8, 1)), sg.Text("to"),
         sg.Input(str(DEFAULT_T_MAX_S), key="-TMAX-", size=(8, 1))],
        [sg.HorizontalSeparator()],
        [sg.Text("Y-axis:"), sg.Combo(values=Y_AXIS_OPTIONS, key="-YAXIS-", size=(14, 1),
                  default_value="Frequency", enable_events=True)],
        [sg.Text("Devices (shared; table is per axis)")],
        [sg.Listbox(values=[], key="-DEVICES-", size=(24, 4), enable_events=True)],
        [sg.Input(key="-NEW_DEVICE-", size=(18, 1)), sg.Button("Add device", key="-ADD_DEVICE-"),
         sg.Button("Remove device", key="-REMOVE_DEVICE-")],
        [sg.Text("Device color:"), sg.Combo(DEVICE_COLOR_NAMES, key="-DEVICE_COLOR-", size=(10, 1)),
         sg.Button("Set color", key="-SET_DEVICE_COLOR-")],
        [sg.Text("Pickup (Y) / Time (s) — single values or comma-separated (e.g. 1.05,1.1 and 2.5,3):")],
        [sg.Table(values=[], headings=["Pickup (Y)", "Time (s)"], key="-TABLE-",
                  num_rows=8, col_widths=[12, 12], enable_events=True)],
        [sg.Text("Pickup (Y):"), sg.Input(key="-PICKUP-", size=(10, 1)),
         sg.Text("Time (s):"), sg.Input(key="-TIME-S-", size=(10, 1))],
        [sg.Button("Add point", key="-ADD_ROW-"), sg.Button("Update row", key="-UPDATE_ROW-"),
         sg.Button("Paste rows", key="-PASTE_ROWS-"), sg.Button("Delete selected row", key="-DEL_ROW-")],
        [sg.HorizontalSeparator()],
        [sg.Text("Graph title:"), sg.Input(key="-GRAPH_TITLE-", size=(28, 1), default_text="Frequency Coordination")],
        [sg.Text("X-axis label:"), sg.Input(key="-X_LABEL-", size=(26, 1), default_text="Time (s)")],
        [sg.Text("Y-axis label:"), sg.Input(key="-Y_LABEL-", size=(26, 1), default_text="")],
        [sg.Checkbox("Show tickmarks on axes", key="-SHOW_TICKS-", default=True)],
        [sg.Checkbox("Show gridlines", key="-SHOW_GRID-", default=False)],
        [sg.Checkbox("Log scale (X-axis)", key="-X_LOG_SCALE-", default=False)],
        [sg.Text("Plot area background:"), sg.Combo(list(PLOT_BACKGROUNDS.keys()), key="-PLOT_BG-",
                  default_value="Light gray", size=(14, 1))],
        [sg.Button("Draw TCC (Current)", key="-DRAW_CURRENT-"),
         sg.Button("Draw TCC (Voltage)", key="-DRAW_VOLTAGE-"),
         sg.Button("Draw TCC (Frequency)", key="-DRAW_FREQUENCY-")],
        [sg.HorizontalSeparator()],
        [sg.Button("Export JSON", key="-EXPORT_JSON-"), sg.Button("Import JSON", key="-IMPORT_JSON-")],
    ]


def make_legend_column():
    """Legend panel: one row per device — short colored line + name (no highlight)."""
    legend_rows = [
        [sg.Text("", key=f"-LEGEND_LINE_{i}-", size=(2, 1), visible=False),
         sg.Text("", key=f"-LEGEND_NAME_{i}-", size=(14, 1), visible=False)]
        for i in range(MAX_LEGEND_ENTRIES)
    ]
    return [
        [sg.Frame("Legend", legend_rows, size=(160, 320), key="-LEGEND_FRAME-")],
    ]


def make_plot_tab():
    return [
        [sg.Graph(GRAPH_SIZE, (0, 0), (10000, 100),
                  key="-GRAPH-", background_color="white", pad=(10, 10)),
         sg.Column(make_legend_column(), vertical_alignment="top", pad=(0, 10))],
    ]


def main():
    global current_y_name, current_device_name

    sg.theme("LightGrey1")

    input_tab = sg.Tab("Input", make_left_column(), key="-TAB_INPUT-")
    plot_tab = sg.Tab("Plot", make_plot_tab(), key="-TAB_PLOT-")
    layout = [
        [sg.TabGroup([[input_tab, plot_tab]], key="-TABGROUP-", enable_events=True)],
    ]

    window = sg.Window("TCC Curve", layout, resizable=True, finalize=True)
    graph = window["-GRAPH-"]

    ensure_y_axes()
    window["-YAXIS-"].update(value="Frequency")
    current_y_name = "Frequency"
    window["-DEVICES-"].update(shared_devices)
    window["-Y_LABEL-"].update(Y_AXIS_DISPLAY_LABELS.get(current_y_name, current_y_name))
    window["-GRAPH_TITLE-"].update(GRAPH_TITLE_DEFAULTS.get(current_y_name, "TCC Curve"))

    while True:
        event, values = window.read()
        if event in (sg.WIN_CLOSED, "Exit"):
            break

        if event == "-YAXIS-":
            sel = values["-YAXIS-"]
            if isinstance(sel, list):
                sel = sel[0] if sel else None
            current_y_name = sel
            if current_y_name:
                window["-DEVICES-"].update(shared_devices)
                window["-Y_LABEL-"].update(Y_AXIS_DISPLAY_LABELS.get(current_y_name, current_y_name))
                window["-GRAPH_TITLE-"].update(GRAPH_TITLE_DEFAULTS.get(current_y_name, "TCC Curve"))
                current_device_name = None
                window["-TABLE-"].update(values=[])

        if event == "-ADD_DEVICE-":
            name = (values["-NEW_DEVICE-"] or "").strip()
            if name and name not in shared_devices:
                shared_devices.append(name)
                ensure_y_axes()
                for ax in y_axes.values():
                    ax["device_tables"][name] = []
                window["-DEVICES-"].update(shared_devices)
                window["-NEW_DEVICE-"].update("")

        if event == "-REMOVE_DEVICE-":
            sel = values.get("-DEVICES-") or []
            if not sel:
                sg.popup_ok("Select a device in the list to remove.", title="Remove device")
                continue
            name = sel[0]
            shared_devices.remove(name)
            for ax in y_axes.values():
                ax["device_tables"].pop(name, None)
            device_colors.pop(name, None)
            if current_device_name == name:
                current_device_name = None
                window["-TABLE-"].update(values=[])
                window["-DEVICE_COLOR-"].update(value=DEVICE_COLOR_NAMES[0])
            window["-DEVICES-"].update(shared_devices)

        if event == "-DEVICES-":
            sel = values["-DEVICES-"]
            if sel:
                current_device_name = sel[0]
                pts = get_device_points(current_y_name or "", current_device_name)
                window["-TABLE-"].update(values=build_points_table(pts))
                hex_val = get_device_color(current_device_name)
                window["-DEVICE_COLOR-"].update(value=HEX_TO_COLOR_NAME.get(hex_val, DEVICE_COLOR_NAMES[0]))

        if event == "-SET_DEVICE_COLOR-":
            if current_device_name and values.get("-DEVICE_COLOR-"):
                name = values["-DEVICE_COLOR-"]
                if name in DEVICE_COLOR_HEX:
                    device_colors[current_device_name] = DEVICE_COLOR_HEX[name]

        if event == "-TABLE-":
            # Clicked a row: load its Pickup and Time into the inputs so user can edit and click Update row
            if not current_y_name or not current_device_name:
                continue
            sel_rows = values.get("-TABLE-")
            if isinstance(sel_rows, list) and len(sel_rows) > 0:
                idx = sel_rows[0]
                pts = get_device_points(current_y_name, current_device_name)
                if 0 <= idx < len(pts):
                    p, t = pts[idx]
                    window["-PICKUP-"].update(str(p))
                    window["-TIME-S-"].update(f"{t/1000:.2f}")

        if event == "-PASTE_ROWS-":
            if not current_device_name:
                sg.popup_ok("Please select a device first.", title="No device selected")
                continue
            if not current_y_name:
                continue
            text = get_clipboard_text(window)
            if not text.strip():
                sg.popup_ok("Clipboard is empty. Copy rows as 'pickup time' or 'pickup,time' per line (e.g. from Excel).", title="Paste rows")
                continue
            rows = parse_pasted_rows(text)
            if not rows:
                sg.popup_ok("Could not parse clipboard. Use two values per line: Pickup (Y) and Time (s), separated by tab or comma.", title="Paste rows")
                continue
            pts = get_device_points(current_y_name, current_device_name)
            for p, t_ms in rows:
                pts.append((p, t_ms))
            pts.sort(key=lambda x: x[1])
            window["-TABLE-"].update(values=build_points_table(pts))
            sg.popup_quick_message(f"Added {len(rows)} row(s)", auto_close_duration=1)

        if event == "-ADD_ROW-":
            if not current_device_name:
                sg.popup_ok("Please select a device first.", title="No device selected")
                continue
            if not current_y_name:
                continue
            parsed = parse_comma_separated_pickup_time(
                values.get("-PICKUP-") or "", values.get("-TIME-S-") or ""
            )
            if not parsed:
                continue
            pts = get_device_points(current_y_name, current_device_name)
            for p, t in parsed:
                pts.append((p, t))
            pts.sort(key=lambda x: x[1])
            window["-TABLE-"].update(values=build_points_table(pts))
            window["-PICKUP-"].update("")
            window["-TIME-S-"].update("")
            if len(parsed) > 1:
                sg.popup_quick_message(f"Added {len(parsed)} points", auto_close_duration=1)

        if event == "-UPDATE_ROW-":
            if not current_y_name or not current_device_name:
                continue
            sel_rows = values.get("-TABLE-")
            if not isinstance(sel_rows, list) or len(sel_rows) == 0:
                continue
            idx = sel_rows[0]
            pts = get_device_points(current_y_name, current_device_name)
            if idx < 0 or idx >= len(pts):
                continue
            try:
                p = float((values["-PICKUP-"] or "0").strip())
                s = float((values["-TIME-S-"] or "0").strip())
                t = int(round(s * 1000)) if s >= 0 else 0
            except (ValueError, TypeError):
                continue
            pts[idx] = (p, t)
            pts.sort(key=lambda x: x[1])
            window["-TABLE-"].update(values=build_points_table(pts))
            window["-PICKUP-"].update("")
            window["-TIME-S-"].update("")

        if event == "-DEL_ROW-":
            if not current_y_name or not current_device_name:
                continue
            sel_rows = values["-TABLE-"]
            if sel_rows is None:
                sel_rows = []
            rows = get_device_points(current_y_name, current_device_name)
            if isinstance(sel_rows, list) and len(sel_rows) > 0:
                idx = sel_rows[0]
                if 0 <= idx < len(rows):
                    rows.pop(idx)
            window["-TABLE-"].update(values=build_points_table(rows))

        if event == "-EXPORT_JSON-":
            path = sg.popup_get_file(
                "Save configuration as",
                save_as=True,
                default_extension=".json",
                file_types=(("JSON files", "*.json"), ("All files", "*.*")),
            )
            if path:
                try:
                    with open(path, "w", encoding="utf-8") as f:
                        json.dump(export_to_json(), f, indent=2)
                    sg.popup_quick_message("Saved.", auto_close_duration=1)
                except Exception as e:
                    sg.popup_error(f"Export failed:\n{e}")

        if event == "-IMPORT_JSON-":
            path = sg.popup_get_file(
                "Load configuration",
                file_types=(("JSON files", "*.json"), ("All files", "*.*")),
            )
            if path:
                try:
                    with open(path, "r", encoding="utf-8") as f:
                        load_from_json(json.load(f))
                except Exception as e:
                    sg.popup_error(f"Import failed:\n{e}")
                    continue
                # Refresh UI
                ensure_y_axes()
                current_y_name = current_y_name if current_y_name in Y_AXIS_OPTIONS else "Frequency"
                window["-YAXIS-"].update(value=current_y_name)
                window["-DEVICES-"].update(shared_devices)
                window["-Y_LABEL-"].update(Y_AXIS_DISPLAY_LABELS.get(current_y_name, current_y_name))
                window["-GRAPH_TITLE-"].update(GRAPH_TITLE_DEFAULTS.get(current_y_name, "TCC Curve"))
                if current_device_name and current_device_name in shared_devices:
                    pts = get_device_points(current_y_name, current_device_name)
                    window["-TABLE-"].update(values=build_points_table(pts))
                else:
                    current_device_name = None
                    window["-TABLE-"].update(values=[])

        if event in ("-DRAW_CURRENT-", "-DRAW_VOLTAGE-", "-DRAW_FREQUENCY-"):
            y_name = {"-DRAW_CURRENT-": "Current", "-DRAW_VOLTAGE-": "Voltage", "-DRAW_FREQUENCY-": "Frequency"}[event]
            try:
                s_min = float(values["-TMIN-"] or DEFAULT_T_MIN_S)
                s_max = float(values["-TMAX-"] or DEFAULT_T_MAX_S)
                t_min = int(round(s_min * 1000))
                t_max = int(round(s_max * 1000))
                if t_max <= t_min:
                    t_max = t_min + 1000
            except (ValueError, TypeError):
                t_min = int(round(DEFAULT_T_MIN_S * 1000))
                t_max = int(round(DEFAULT_T_MAX_S * 1000))
            # Use title and y-axis label for the graph being drawn (Voltage vs Frequency), not form values
            title = GRAPH_TITLE_DEFAULTS.get(y_name, "TCC Curve")
            y_label = Y_AXIS_DISPLAY_LABELS.get(y_name, y_name)
            x_label = (values["-X_LABEL-"] or "").strip()
            show_tickmarks = values.get("-SHOW_TICKS-", True)
            show_gridlines = values.get("-SHOW_GRID-", False)
            x_log_scale = values.get("-X_LOG_SCALE-", False)
            plot_bg = values.get("-PLOT_BG-", "Light gray") or "Light gray"
            draw_tcc_curve(graph, t_min, t_max, y_name,
                          title=title, x_label=x_label, y_label=y_label,
                          show_tickmarks=show_tickmarks, show_gridlines=show_gridlines,
                          plot_background_key=plot_bg, x_log_scale=x_log_scale)
            devices_with_points = [d for d in shared_devices if y_axes[y_name]["device_tables"].get(d)]
            _draw_legend_panel(window, devices_with_points)
            # Keep form in sync with the graph we just drew
            window["-YAXIS-"].update(value=y_name)
            window["-GRAPH_TITLE-"].update(title)
            window["-Y_LABEL-"].update(y_label)
            current_y_name = y_name
            try:
                window["-TABGROUP-"].Widget.select(1)
            except Exception:
                pass
    window.close()


if __name__ == "__main__":
    main()
