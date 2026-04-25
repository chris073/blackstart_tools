================================================================================
  IEEE 2800 PFR Calcs - How to Use
================================================================================

This program evaluates Power Frequency Response (PFR) over a 10-second window
using phasor data (V, I, angles) and reports results against IEEE 2800-style
acceptance criteria (Reaction Time, Rise Time, damping ratio, etc.).

--------------------------------------------------------------------------------
1. INSTALLATION
--------------------------------------------------------------------------------

  (1) Install Python 3.8 or later (e.g. from python.org).

  (2) Install dependencies. From the folder containing ieee2800_pfr.py, run:

        pip install -r requirements.txt

      Or install manually:

        pip install FreeSimpleGUI pandas numpy openpyxl

--------------------------------------------------------------------------------
2. DATA SETUP
--------------------------------------------------------------------------------

  (1) Create a folder named "source_data" next to ieee2800_pfr.py.

  (2) Place your phasor data file in that folder:
        source_data/phasor_data.xlsx

  (3) The Excel file must have:
      - A sheet named "phasor_data"
      - Row 1: Headers including "Time (UTC)" (or time_utc, etc.) and the
        phasor columns: va, vb, vc, va_ang, vb_ang, vc_ang, ia, ib, ic,
        ia_ang, ib_ang, ic_ang
      - Row 2 onward: Data with timestamps and numeric phasor values covering
        the event (from your chosen start time through ~10 seconds later)

  If the file is missing, the program will show an error when you start it
  and tell you where it looked.

--------------------------------------------------------------------------------
3. RUNNING THE PROGRAM
--------------------------------------------------------------------------------

  From a command prompt or terminal, go to the folder that contains
  ieee2800_pfr.py and run:

        python ieee2800_pfr.py

  The "IEEE 2800 PFR Calcs" window will open. If phasor_data.xlsx is not
  found, you will see an error popup instead.

--------------------------------------------------------------------------------
4. USING THE GUI
--------------------------------------------------------------------------------

  TOP ROW
  -------
  Time (UTC) .......... Enter the start time of the event (t = 0 for the
                        report). Examples: 2/5/2026 18:04:52.733  or
                        2026-02-05 18:04:52.733

  Delta P target (MW)  Enter the active power step size in MW. Can be
                        positive (power increase) or negative (power decrease).
                        Example: -15.82

  Run Report .......... Click to run the 10-second analysis and fill the
                        results area.

  PASS/FAIL CRITERIA
  ------------------
  You can change the limits used for Pass/Fail in the report:

  - 10% Response Time (ms) .. Max allowed time to reach 10% of delta P
                              (e.g. 200; range 200 ms to 1 s)

  - 90% Response Time (ms) .. Max allowed time to reach 90% of delta P
                              (e.g. 2000; range 2000 ms to 20000 ms)

  - Damping Ratio (Zeta) ..... Minimum acceptable damping from overshoot
                              (e.g. 0.3; range 0.2 to 1.0)

  ACCEPTANCE CRITERIA IMAGE
  -------------------------
  If you place an image (e.g. acceptance_criteria.png) in the "assets" folder
  next to ieee2800_pfr.py, it will be shown in the window as a reference
  (e.g. Reaction time, Rise time, Settling time, Damping ratio, Settling band).

--------------------------------------------------------------------------------
5. READING THE REPORT
--------------------------------------------------------------------------------

  After you click "Run Report", the text area shows:

  - Start (pre-step) row ..... The data row used for initial P, Q, S (before
                               the step). Time and P, Q, S in MW, MVar, MVA.

  - Requested timestamp (t=0)  The time you entered. All delta_t values in the
                               table are "time since" this moment.

  - delta_P_target ........... The step size you entered (MW).

  - Estimated damping ratio .. ζ computed from % overshoot; Pass/Fail vs the
                               Damping Ratio (Zeta) criterion you set.

  - Table .................... One row per test parameter:

      Test Parameter          Pass/Fail   delta_t (s)   P (MW)   Q (MVar)   S (MVA)
      -------------------------------------------------------------------------------
      Reaction Time (10%)     Pass/Fail   ...           ...      ...        ...
      Rise Time (90%)         Pass/Fail   ...           ...      ...        ...
      Max overshoot (%, ζ)    Pass/Fail   ...           ...      ...        ...
      Setting Time (10s)      -           ...           ...      ...        ...

  - delta_t is the time in seconds from your requested timestamp to when that
    criterion was met (or to the sample nearest 10 s for Setting Time).
  - Pass/Fail for Reaction Time and Rise Time uses your 10% and 90% response
    time limits (in ms). Pass/Fail for Max overshoot uses your Damping Ratio
    (Zeta) limit.

--------------------------------------------------------------------------------
6. TROUBLESHOOTING
--------------------------------------------------------------------------------

  "Phasor data file not found"
  -> Put phasor_data.xlsx in the source_data folder next to ieee2800_pfr.py
     (or see REQUIREMENTS.md for other locations the program checks).

  "Worksheet 'phasor_data' not found"
  -> Rename your sheet to "phasor_data" (case-insensitive).

  "Column 'va' not found on row 1"
  -> Ensure row 1 has headers exactly: va, vb, vc, va_ang, vb_ang, vc_ang,
     ia, ib, ic, ia_ang, ib_ang, ic_ang (and a Time (UTC) column). Names are
     normalized (trimmed, lowercased, spaces to underscores).

  "Invalid timestamp format"
  -> Use a format like 2/5/2026 18:04:52 or 2026-02-05 18:04:52.733.

  "No rows in the 10-second window"
  -> Your data must contain rows from the requested time through ~10 seconds
     later. Check that the Time (UTC) column covers that range.

  "Need openpyxl: pip install openpyxl"
  -> Install openpyxl:  pip install openpyxl

--------------------------------------------------------------------------------
7. FILES IN THIS FOLDER
--------------------------------------------------------------------------------

  ieee2800_pfr.py ..... Main program (run this).
  requirements.txt .... Python package list for pip.
  REQUIREMENTS.md ..... Detailed system and data requirements.
  README.TXT .......... This file.
  source_data/ ........ Put phasor_data.xlsx here.
  assets/ ............. Optional: acceptance_criteria image for the GUI.

================================================================================
