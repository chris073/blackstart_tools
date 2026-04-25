"""
Tag name augmenter: prepend static prefix + type + index to each line.
Uses FreeSimpleGUI (PySimpleGUI-compatible API).

DNP3: 5-digit index; for output types (BO, AO), each list line yields three tags:
base, base.status, base.oper.

Modbus: Coils use a 4-digit index and one tag per line ending in .status;
Discrete Inputs, Holding Registers, and Input Registers use a 5-digit index
and one tag per line (DI_, HREG_, IREG_ prefixes).

Coil to stVal: one IEC 61131 PROGRAM with VAR/END_VAR once; per tag line, an SR
instance _TAG and one call wiring operSet/operClear to status.stVal (COIL index
uses 5 digits, same as the static.COIL_nnnnn_tag path in the example).
"""

import re

import FreeSimpleGUI as sg

PROTOCOL_OPTIONS = ["DNP3", "Modbus", "Coil to stVal"]

DNP3_TYPE_OPTIONS = [
    "BI - Binary Inputs",
    "BO - Binary Outputs",
    "AI - Analog Inputs",
    "AO - Analog Outputs",
]

MODBUS_TYPE_OPTIONS = [
    "Coils",
    "Discrete Inputs",
    "Holding Registers",
    "Input Registers",
]

MODBUS_LABEL_TO_CODE = {
    "Coils": "COIL",
    "Discrete Inputs": "DI",
    "Holding Registers": "HREG",
    "Input Registers": "IREG",
}

COIL_TO_STVAL_TYPE_OPTIONS = ["Coil"]

OUTPUT_TYPE_CODES = frozenset({"BO", "AO"})


def combo_to_type_code(combo_value: str) -> str:
    if not combo_value:
        return ""
    return combo_value.split(" - ", 1)[0].strip()


def modbus_combo_to_code(combo_value: str) -> str:
    if not combo_value:
        return ""
    return MODBUS_LABEL_TO_CODE.get(combo_value.strip(), "")


def parse_tag_lines(raw: str) -> list[str]:
    lines = []
    for line in raw.splitlines():
        s = line.strip()
        if s:
            # Tags are later embedded into a dot/underscore key; normalize any
            # internal whitespace (e.g. "My Tag" -> "My_Tag") to keep the output
            # consistent.
            s = re.sub(r"\s+", "_", s)
            lines.append(s)
    return lines


def build_augmented_tags(
    static: str,
    type_code: str,
    start: int,
    tag_lines: list[str],
) -> list[str]:
    static = static.strip()
    type_code = type_code.strip()
    out = []
    n = start
    is_output = type_code in OUTPUT_TYPE_CODES
    for tag in tag_lines:
        base = f"{static}.{type_code}_{n:05d}_{tag}"
        if is_output:
            out.append(base)
            out.append(f"{base}.status")
            out.append(f"{base}.oper")
        else:
            out.append(base)
        n += 1
    return out


def build_modbus_tags(
    static: str,
    type_code: str,
    start: int,
    tag_lines: list[str],
) -> list[str]:
    """type_code is COIL, DI, HREG, or IREG."""
    static = static.strip()
    type_code = type_code.strip()
    out = []
    n = start
    for tag in tag_lines:
        if type_code == "COIL":
            base = f"{static}.COIL_{n:04d}_{tag}"
            out.append(f"{base}.status")
        else:
            out.append(f"{static}.{type_code}_{n:05d}_{tag}")
        n += 1
    return out


def build_coil_to_stval(static: str, start: int, tag_lines: list[str]) -> str:
    """ST program: one PROGRAM/VAR block; per tag, _TAG : SR and one SR() call."""
    static = static.strip()
    var_lines: list[str] = []
    body_lines: list[str] = []
    n = start
    for tag in tag_lines:
        inst = f"_{tag}"
        coil = f"{static}.COIL_{n:05d}_{tag}"
        var_lines.append(f"    {inst} : SR;")
        body_lines.append(
            f"{inst}(SET1:= {coil}.operSet.ctlVal, RESET:= {coil}.operClear.ctlVal , Q1=> {coil}.status.stVal);"
        )
        n += 1
    var_block = "\n".join(var_lines)
    body_block = "\n".join(body_lines)
    return (
        "PROGRAM COIL_TO_STATUS\n"
        "VAR\n"
        f"{var_block}\n"
        "END_VAR\n"
        "\n"
        f"{body_block}"
    )


def type_options_for_protocol(protocol: str) -> list[str]:
    p = (protocol or "").strip()
    if p == "Modbus":
        return list(MODBUS_TYPE_OPTIONS)
    if p == "Coil to stVal":
        return list(COIL_TO_STVAL_TYPE_OPTIONS)
    return list(DNP3_TYPE_OPTIONS)


def sync_type_combo(window: sg.Window, protocol: str) -> None:
    opts = type_options_for_protocol(protocol)
    window["-TYPE-"].update(values=opts, value=opts[0] if opts else "")


def tag_editor_layout() -> list:
    return [
        [
            sg.Text("Static string", size=(14, 1)),
            sg.Input(
                default_text="SHARED_CAISO_TENAKSA_MAP_DNP",
                key="-STATIC-",
                expand_x=True,
            ),
        ],
        [
            sg.Text("Protocol", size=(14, 1)),
            sg.Combo(
                PROTOCOL_OPTIONS,
                default_value=PROTOCOL_OPTIONS[0],
                key="-PROTOCOL-",
                readonly=True,
                size=(32, 1),
                enable_events=True,
            ),
        ],
        [
            sg.Text("Type", size=(14, 1)),
            sg.Combo(
                DNP3_TYPE_OPTIONS,
                default_value=DNP3_TYPE_OPTIONS[0],
                key="-TYPE-",
                readonly=True,
                size=(32, 1),
            ),
            sg.Text("Start at"),
            sg.Input(default_text="1", key="-START-", size=(8, 1)),
        ],
        [sg.HorizontalSeparator()],
        [
            sg.Text("Tag list (one per line, paste OK)"),
        ],
        [
            sg.Multiline(
                default_text='AGG_UCON_GENX\n52L1_CB2',
                key="-TAGS-",
                size=(72, 12),
                expand_x=True,
                expand_y=True,
                autoscroll=True,
            )
        ],
        [
            sg.Button("Generate", key="-GEN-", bind_return_key=True),
            sg.Push(),
            sg.Button("Copy results", key="-COPY-"),
        ],
        [sg.Text("Results")],
        [
            sg.Multiline(
                default_text="",
                key="-OUT-",
                size=(72, 10),
                expand_x=True,
                expand_y=True,
                autoscroll=True,
                write_only=False,
            )
        ],
    ]


def main() -> None:
    tag_tab = sg.Tab("Tag Editor", tag_editor_layout(), key="-TAB-TAG-")

    layout = [
        [
            sg.TabGroup(
                [[tag_tab]],
                key="-TABS-",
                expand_x=True,
                expand_y=True,
            )
        ]
    ]

    window = sg.Window(
        "Tag tools",
        layout,
        resizable=True,
        finalize=True,
    )
    window["-TAGS-"].expand(True, True, True)
    window["-OUT-"].expand(True, True, True)

    while True:
        event, values = window.read()
        if event in (sg.WIN_CLOSED, "Exit"):
            break
        if event == "-PROTOCOL-":
            sync_type_combo(window, values.get("-PROTOCOL-") or "")
        if event == "-GEN-":
            raw_tags = values["-TAGS-"] or ""
            tags = parse_tag_lines(raw_tags)
            static = (values["-STATIC-"] or "").strip()
            protocol = (values.get("-PROTOCOL-") or "").strip() or "DNP3"
            type_sel = values["-TYPE-"] or ""
            start_raw = (values["-START-"] or "").strip()
            if not start_raw:
                start_raw = "1"
            if not re.fullmatch(r"-?\d+", start_raw):
                sg.popup_error("Start at must be an integer.")
                continue
            start = int(start_raw)
            if not tags:
                sg.popup_error("Add at least one tag line.")
                continue
            if protocol == "Coil to stVal":
                if not static:
                    sg.popup_error("Static string is required.")
                    continue
                window["-OUT-"].update(build_coil_to_stval(static, start, tags))
            else:
                if protocol == "Modbus":
                    type_code = modbus_combo_to_code(type_sel)
                else:
                    type_code = combo_to_type_code(type_sel)
                if not static or not type_code:
                    sg.popup_error("Static string and Type are required.")
                    continue
                if protocol == "Modbus":
                    lines = build_modbus_tags(static, type_code, start, tags)
                else:
                    lines = build_augmented_tags(static, type_code, start, tags)
                window["-OUT-"].update("\n".join(lines))
        elif event == "-COPY-":
            text = values["-OUT-"] or ""
            if text.strip():
                try:
                    sg.clipboard_set(text)
                    sg.popup_quick_message("Copied", auto_close_duration=1)
                except Exception:
                    sg.popup_error("Could not copy to clipboard on this system.")

    window.close()


if __name__ == "__main__":
    main()
