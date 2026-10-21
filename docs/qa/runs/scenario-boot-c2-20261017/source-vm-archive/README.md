# C2 source VM archive transport

`source-vm-raw.zip` contains the unchanged original bytes of five source VM output directories: `boot-c1-source`, `boot-c2-source`, `crop-source`, `npc-source`, and `shortage-source`. Their five native reports remain independently readable at their original paths outside this directory.

Archive entry paths are relative to `docs/qa/runs/scenario-boot-c2-20261017` (the QA root), not to this `source-vm-archive` directory. Standard-unzip the archive with the QA root as the destination to restore every archived relative path. The archive index records all 442 entry sizes and SHA256 hashes; the roundtrip receipt records actual standard extraction into a new empty directory and verifies every file and native artifact reference.

One original NPC artifact reference is deliberately external: `npc-source/npc-artifacts/inputs/natural19-original-report.json` maps through the QA root's unchanged `transport-input-rebindings.json` to `docs/qa/runs/crop-target-v1-20261017/natural-fresh06/report.json`, SHA256 `aa4dbcdbd0dc7943af9940e8b7b87acf96b487145d626e1fcfbdc64ff357f4a5`. This existing original input is not copied into the archive. A reference-traversing reader must apply that explicit map after extraction.

The generic evidence Gate reads ordinary manifest files and retained native report summaries; it does not read ZIP members. Direct traversal of archived native artifact references requires extraction first. Publication manifests should inventory this archive and its index/receipts plus retained report files, rather than paths removed into the archive.

This is lossless publication transport only. It does not represent another game, source-checker, or browser execution. No source, assertions, native report fields, counts, receipts, or effects were altered. Other top-level source reports and browser screenshots remain separate files. Empty original directories are retained.
