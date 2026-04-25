# IEEE 2800 PFR Calcs – Requirements

## 1. System requirements

- **Python**: 3.8 or later (3.9+ recommended).
- **OS**: Windows, macOS, or Linux (GUI tested on Windows).

## 2. Python dependencies

The program requires these packages (install via `pip install -r requirements.txt` or individually):

| Package         | Purpose                                      |
|-----------------|----------------------------------------------|
| FreeSimpleGUI   | Graphical user interface (dialogs, inputs)   |
| pandas          | Datetime handling and data processing       |
| numpy           | Numeric calculations (P, Q, S from phasors)|
| openpyxl        | Reading Excel (.xlsx) phasor data           |

## 3. Data file requirements

### 3.1 Location

- **Preferred**: Place the phasor data file in a folder named `source_data` next to `ieee2800_pfr.py`.
- **Example path**: `.../sce_reports/source_data/phasor_data.xlsx`
- The program also looks in the script directory, parent directories, and current working directory (see in-app error message if the file is not found).

### 3.2 File format

- **Format**: Excel workbook (`.xlsx`) is required for the 10-second window report. CSV is only used for file-existence checks in some paths.
- **Filename**: `phasor_data.xlsx` (or `phasor_data.csv` for discovery only; report needs .xlsx).

### 3.3 Worksheet and structure

- **Sheet name**: A worksheet named **`phasor_data`** (case-insensitive).
- **Row 1**: Column headers (exact names normalized: trimmed, lowercased, spaces → underscores).

### 3.4 Required columns

**Time**

- One of: `Time (UTC)`, `time_(utc)`, `time(utc)`, `time_utc`, or `timestamp`.

**Phasor quantities (12 columns)**

- Voltages (V, rms): `va`, `vb`, `vc`
- Voltage angles (degrees): `va_ang`, `vb_ang`, `vc_ang`
- Currents (A, rms): `ia`, `ib`, `ic`
- Current angles (degrees): `ia_ang`, `ib_ang`, `ic_ang`

**Data**

- Row 2 and below: numeric values; time column in a format pandas can parse (e.g. `YYYY-MM-DD HH:MM:SS` or Excel datetime).
- Sampling: Data should cover the event window (requested timestamp through requested timestamp + 10 seconds) so that Reaction Time (10%), Rise Time (90%), max overshoot, and Settling Time (10 s) can be computed.

## 4. Optional assets

- **Acceptance criteria image**: To show the IEEE 2800 acceptance criteria table in the GUI, place an image (e.g. `acceptance_criteria.png` or `.jpg`) in the **`assets`** folder next to `ieee2800_pfr.py`. If no image is found, the program shows a message with the path where to put it.

## 5. Functional requirements (what the program does)

- **Inputs**: User provides a **Time (UTC)** (start of the event) and **Delta P target (MW)** (positive or negative).
- **Pass/fail criteria** (editable in the GUI):
  - **10% Response Time (ms)**: e.g. 200 ms (range 200 ms to 1 s).
  - **90% Response Time (ms)**: e.g. 2000 ms (range 2000 ms to 20000 ms).
  - **Damping ratio (zeta)**: e.g. 0.3 (range 0.2 to 1.0).
- **Output**: A report that includes:
  - Pre-step row (time, P, Q, S) and requested timestamp (t = 0).
  - Estimated damping ratio ζ from overshoot and pass/fail vs. IEEE 2800 target.
  - A table with test parameters: **Reaction Time (10%)**, **Rise Time (90%)**, **Max overshoot**, **Setting Time (10s)**; each with **Pass/Fail**, **delta_t (s)**, **P (MW)**, **Q (MVar)**, **S (MVA)**. `delta_t` is measured from the **requested timestamp**, not the pre-step row.

## 6. References

- **IEEE Std 2800**: Acceptance criteria (Reaction time, Rise time, Settling time, Damping ratio, Settling band) are aligned with IEEE 2800 for grid-forming and related performance.
