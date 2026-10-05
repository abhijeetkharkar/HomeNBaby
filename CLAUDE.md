# Home & Baby Project: Agent Guidelines & Botanical Image Generation Framework

This file serves as the core instruction guide for AI agents (Antigravity, Claude, and others) working in this repository.

---

## 1. Core Workflow: Advisor First

Always act as an advisor first, and an assistant to implement second:
1. **Explain the Root Cause:** Clearly diagnose why a problem occurred or what context surrounds the request.
2. **Propose Potential Solutions:** Offer realistic approaches with pros/cons, and recommend the best one.
3. **Wait for Approval:** Do NOT make source code edits or run modifying commands until the user gives explicit approval.
4. **Execute & Verify:** Run builds (`npm run build`) and linters (`npm run lint`), verifying changes on the local development server before declaring completion.

---

## 2. Botanical Image Generation Framework

Whenever generating plant imagery for the Plants app (`apps/plants`), strictly adhere to these proven rules. They ensure high-resolution, photorealistic, and botanically accurate photography matching the UI design system.

### A. The Golden Rule: Highlight the Defining Botanical Feature
Every plant has one primary visual signature that defines it. Never generate a generic, faraway leafy bush. Always center the composition around that defining feature:

| Plant Category | Primary Focus | What to Highlight in the Prompt | Examples |
| :--- | :--- | :--- | :--- |
| **Fruit / Crop** | **The Developing Fruit / Curd** | Knobby rind, bumpy texture, natural cluster on stem or tree branch with surrounding healthy foliage. | Jackfruit (fruit rind), Cauliflower (creamy curd cupped in leaves), Eggplant, Tomato |
| **Flowering** | **Bloom Inflorescence / Flower Cluster** | Dense flower heads, petal shape, contrasting central eyes, or curved spathes. | Ixora (dense scarlet spherical clusters), Periwinkle (5 petals with magenta eye), Peace Lily (white spathe & spadix) |
| **Foliage Houseplant** | **Leaf Texture, Venation & Sheen** | Leaf surface texture, puckering/quilted relief, bold marbling, metallic/iridescent sheen, prominent midribs, or emerging leaf sheaths. | Rex Begonia (iridescent swirl), Friendship Plant (quilted bronze with silver stripe), Ficus Burgundy (glossy dark leaves with ruby spike), Golden Pothos (golden marbling) |
| **Succulents & Cacti** | **Fleshy Forms & Stressed Margins** | Distinctive tubular/suction shapes, compact rosettes, red/sun-kissed margins, gritty soil mix. | Crassula Ogre Ears (Gollum leaves with red tips), Aloe Vera |

### B. Aspect Ratio & Framing
* **Ratio:** Strictly `1:1` square (`AspectRatio: '1:1'`).
* **Shot Distance:** Medium close-up to macro. The primary botanical subject must occupy 65%–80% of the frame.
* **Vertical Safety:** Avoid placing critical details at the very bottom edge where front-card gradient panels and action buttons overlay the photo.

### C. Lighting & Color Science
* **Indoor Houseplants:** Specify `soft, bright indirect natural indoor lighting` or `soft ambient daylight`. Never use harsh flash, blown-out specular highlights, or artificial CGI lighting.
* **Outdoor Container / Patio Plants:** Specify `warm morning sunlight` or `bright natural outdoor garden sunlight with soft background bokeh`.
* **Foliage Health:** Always specify `pristine, healthy, clean, glossy foliage without dust, water spots, or blemishes`.

### D. Context & Realism Anchors
* Anchor the plant in a believable setting: a clean minimalist ceramic planter, authentic terracotta pot, or gritty soil mix (e.g. pumice, perlite, lava rock for succulents).
* Maintain a clean, tasteful, modern home or patio background with shallow depth of field (subtle bokeh) so the plant stands out without distractions.

### E. Exact Botanical Cultivar Specificity
Always include both the common name and the precise Latin scientific name / cultivar in the prompt:
* e.g., `Ficus elastica 'Burgundy'` instead of "Rubber plant".
* e.g., `Pilea spruceana 'Silver Tree'` instead of "Friendship plant".
* e.g., `Catharanthus roseus` instead of "Periwinkle".
* e.g., `Crassula ovata 'Gollum'` instead of "Ogre ears succulent".

### F. Proven Prompt Templates
```
# Foliage Example (Ficus Burgundy)
"A high-quality close-up photorealistic photograph focusing on a healthy Burgundy Rubber Tree (Ficus elastica 'Burgundy'). The plant features pristine, thick, highly glossy deep dark burgundy-black oval leaves with a rich red central midrib and an emerging vibrant ruby-red new leaf sheath spike at the top. Potted in a clean modern minimalist planter, bathed in soft bright indirect natural indoor lighting with a clean tasteful background. Professional interior botanical photography."

# Bloom Example (Ixora)
"A high-quality close-up photorealistic macro photograph of vibrant scarlet red Ixora coccinea (Jungle Flame) flower clusters. The dense rounded spherical head of dozens of tiny brilliant red-orange four-petaled star-shaped blossoms with yellow center accents is in sharp focus, set against dark glossy green tropical foliage in soft warm natural sunlight. Professional botanical photography."

# Fruit Example (Jackfruit)
"A high-quality close-up photorealistic photograph of a large, healthy green jackfruit hanging on the thick branch of a tropical jackfruit tree. The jackfruit has distinct textured, spiky, knobby hexagonal rind patterns and a natural golden-green tone, surrounded by lush deep green glossy tropical leaves in soft natural daylight. Realistic botanical outdoor photography."
```

---

## 3. Database & UI Naming Standards

1. **Clean Real Common Names Only:**
   - Plant database `name` fields must contain only the clean, real common name (e.g., `Orange`, `Moringa`, `Okra`, `Curry Leaf`, `Frankie Fittonia`).
   - Never append parenthetical ages (`Moringa (2yr)` ❌ ➔ `Moringa` ✅), pot measurements (`Orange Seedling (9in)` ❌ ➔ `Orange` ✅), or colloquial brackets.
2. **Scientific Names:**
   - Always supply `scientificName?: string` with accurate botanical binomials and cultivar quotes (e.g., `Citrus sinensis`, "Pilea spruceana 'Silver Tree'").
   - Displayed as small muted italic text below the common title on cards.

---

## 4. Repository & Workspace Hygiene

* **File Storage:** Plant card photographs must reside in `apps/plants/public/plants/<id>.jpg` and be referenced via `imageUrl: '/plants/<id>.jpg'`.
* **Scoped Staging:** Only stage and commit files related to the specific feature being worked on (e.g., `apps/plants/` and `apps/api/`). Never stage unrelated experimental or third-party files.
* **Build Verification:** Always execute `npm run build` and `npm run lint` in `apps/plants` before submitting commits or creating pull requests.
