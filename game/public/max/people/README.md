# Ultra: real people

Drawn under the Ultra graphics level (the former Max) in place of the drawn bodies
(`src/platform/render/body/realBody.ts`, their lab coat, goggles, shield and gloves in `realWear.ts`).
A character, a person of the world or a responder names its person with `realBody`
(`src/content/characters.json`, `npcs.json`, `responders.json`).

All from the [Microsoft Rocketbox Avatar Library](https://github.com/microsoft/Microsoft-Rocketbox),
Copyright (c) 2020 Microsoft, MIT License (`LICENSE-Rocketbox.md`). Male_Adult_10 and the
catalogue (`Docs/all.pdf`, 7.7 MB, not shipped) were downloaded 2026-11-18 with Phú's word for each;
the other sixteen on 2026-11-18 under his standing word for Ultra's downloads (reputable, licensed
sources). Each was downloaded as its `Export/<name>_facial.fbx` and its `Textures/` folder.

| Folder                      | Rocketbox path               | Who                           | Downloaded | Shipped |
| --------------------------- | ---------------------------- | ----------------------------- | ---------- | ------- |
| `rocketbox-male-adult-10`   | `Adults/Male_Adult_10`       | Khoa (`researcher-male`)      | 79 MB      | 4 MB    |
| `rocketbox-female-adult-05` | `Adults/Female_Adult_05`     | Lan (`researcher-female`)     | 91 MB      | 6 MB    |
| `rocketbox-male-adult-20`   | `Adults/Male_Adult_20`       | Minh (`intern-minh`)          | 74 MB      | 5 MB    |
| `rocketbox-female-adult-08` | `Adults/Female_Adult_08`     | Vy (`intern-vy`)              | 91 MB      | 6 MB    |
| `rocketbox-male-adult-05`   | `Adults/Male_Adult_05`       | Huy (`technician-huy`)        | 90 MB      | 6 MB    |
| `rocketbox-female-adult-02` | `Adults/Female_Adult_02`     | Mai (`biologist-mai`)         | 78 MB      | 6 MB    |
| `rocketbox-male-adult-04`   | `Adults/Male_Adult_04`       | Tuấn (`scientist-tuan`)       | 91 MB      | 6 MB    |
| `rocketbox-female-adult-12` | `Adults/Female_Adult_12`     | Linh (`intern-linh`)          | 91 MB      | 6 MB    |
| `rocketbox-male-adult-07`   | `Adults/Male_Adult_07`       | the teacher (`teacher-quang`) | 90 MB      | 5 MB    |
| `rocketbox-fire-male-01`    | `Professions/Fire_Male_01`   | `firefighter-1`               | 84 MB      | 5 MB    |
| `rocketbox-fire-male-03`    | `Professions/Fire_Male_03`   | `firefighter-2`               | 84 MB      | 6 MB    |
| `rocketbox-fire-male-05`    | `Professions/Fire_Male_05`   | `firefighter-3`               | 86 MB      | 5 MB    |
| `rocketbox-fire-male-06`    | `Professions/Fire_Male_06`   | `firefighter-4`               | 83 MB      | 5 MB    |
| `rocketbox-police-male-01`  | `Professions/Police_Male_01` | `police-1`                    | 88 MB      | 6 MB    |
| `rocketbox-police-male-02`  | `Professions/Police_Male_02` | `police-2`                    | 131 MB     | 7 MB    |
| `rocketbox-police-male-03`  | `Professions/Police_Male_03` | `police-3`                    | 210 MB     | 7 MB    |
| `rocketbox-police-male-04`  | `Professions/Police_Male_04` | `police-4`                    | 120 MB     | 8 MB    |

About 1.7 GB downloaded in all, 89 MB shipped. Paths are under `Assets/Avatars/` of the repository.

Changed from the originals: `Export/<name>_facial.fbx` converted to `body.glb` (mesh, skeleton,
skin weights; 5 of its 175 face shapes kept: the eyes' blinks, the jaw, the smile; the second UV set
dropped), and its TGA textures to WebP: colour 2048², normal 1024², roughness 512² made from the
specular map, the hair and lashes 1024² with their alpha. `manifest.json` lists each part's maps
(Police_Male_03's material is spelt `m172_equpiment` in the original; its maps are found by the
same letters). The responders' own pistols are not drawn.
