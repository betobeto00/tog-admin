docs: note on electron-updater metadata for v1.0.7 release

When the v1.0.7 installer was first uploaded via `gh release upload`,
only the .exe was pushed. electron-updater requires two more files in
the release to detect updates:

- `latest.yml`           — version + sha512 of the setup .exe
- `TOG Admin Setup x.y.z.exe.blockmap` — diff metadata for incremental
  download (not strictly required, but recommended)

Without these, the updater says "up to date" because it can't find any
metadata describing the new version.

Manually uploaded both files to the v1.0.7 release. Future builds should
either:
- Re-run `npm run build:installer` after pushing the tag (electron-builder
  will upload all assets + create the release if it doesn't exist yet),
  OR
- If uploading manually with `gh release upload`, include the
  `latest.yml` and `.blockmap` files that electron-builder generates
  in `release/` next to the .exe.

Also note: the .yml `files[].url` field uses the original filename with
hyphens (TOG-Admin-Setup-1.0.7.exe). GitHub's asset URLs replace spaces
with dots (TOG.Admin.Setup.1.0.7.exe). The .yml was edited to match the
uploaded asset name so electron-updater can resolve the download URL.