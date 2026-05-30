# Design reference

Place `storage_planner_mock.html` here.

The mock is the canonical reference for layout, wording, colors, and
interaction. Check it in unchanged. When appearance and the build spec conflict,
the mock wins on look and the spec wins on data and access.

The mock could not be copied during initial scaffolding because it lives in a
sandboxed Downloads folder. Copy it here with:

  cp ~/Downloads/storage_planner_mock.html design-reference/storage_planner_mock.html

Then diff the CSS variables in index.css against the mock's :root block and align any
discrepancies before the first demo.
