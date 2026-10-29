# 2-minute demo script

1. **Frame it (10 s).** "This is an independent concept built from public information, with synthetic data. I wanted
   to see where the cost lives when a gradebook gets spreadsheet-sized."
2. **Keyboard editing (30 s).** On the 200 x 30 cohort: click a cell, type `9`, Enter. Point at the cell updating, the
   active cell moving down, and the status line announcing the change. Type `99` to show the validation message.
3. **Paste (20 s).** Copy a 2 x 3 block from any spreadsheet, click a cell, paste. Then Ctrl/Cmd+Z: the whole paste undoes.
4. **The measurement (45 s).** Switch to Stress test 1,000 x 60. Edit a cell: about 20 ms keypress-to-painted, 2 rows
   re-rendered, 285 cells in the DOM. Untick Virtualize (expect a few seconds to mount), edit again: React still
   renders in under a millisecond, but keypress-to-painted is about 2 seconds.
5. **The takeaway (15 s).** "React was never the bottleneck. Memoized rows and structural sharing kept it cheap. The
   browser laying out 61,000 nodes was the cost, so windowing is what keeps it instant."
