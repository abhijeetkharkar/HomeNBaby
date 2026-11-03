---
name: plant-image-generator
description: >-
  Generate botanically accurate, photorealistic 1:1 plant photography following the CLAUDE.md
  Botanical Image Generation Framework, save to apps/plants/public/plants/<id>.jpg, and upload to
  the production S3 buckets and CloudFront distribution. Use this skill whenever generating or
  replacing plant card images for the Plants Tracker app.
---

# Botanical Image Generation & S3 Publishing (`plant-image-generator`)

Use this skill whenever generating, regenerating, or publishing plant card photographs (`imageUrl: '/plants/<id>.jpg'`) for the Plants Tracker application.

---

## 1. Botanical Prompt Rules (From `CLAUDE.md` & `AGENTS.md`)

### A. The Golden Rule: Highlight the Defining Botanical Feature
Every plant has one primary visual signature that defines it. **Never generate a generic, faraway leafy bush.** Center 65%–80% of the composition around that defining feature:

| Plant Category | Primary Focus | What to Highlight in the Prompt | Examples |
| :--- | :--- | :--- | :--- |
| **Fruit / Crop** | **Developing Fruit / Curd** | Knobby rind, bumpy texture, natural cluster on stem or branch with healthy surrounding foliage. | Jackfruit (hexagonal spiky rind), Cauliflower (creamy curd cupped in leaves), Eggplant, Tomato |
| **Flowering** | **Bloom Inflorescence / Flower Cluster** | Dense flower heads, petal shape, contrasting central eyes, or curved spathes. | Ixora (dense scarlet spherical clusters), Periwinkle (5 petals with magenta eye), Peace Lily (white spathe & spadix) |
| **Foliage Houseplant** | **Leaf Texture, Venation & Sheen** | Leaf surface texture, puckering/quilted relief, bold marbling, metallic/iridescent sheen, prominent midribs, or emerging leaf sheaths. | Rex Begonia (iridescent swirl), Friendship Plant (quilted bronze with silver stripe), Ficus Burgundy (glossy dark leaves with ruby spike), Golden Pothos (golden marbling) |
| **Succulents & Cacti** | **Fleshy Forms & Stressed Margins** | Distinctive tubular/suction shapes, compact rosettes, red/sun-kissed margins, gritty soil mix. | Crassula Ogre Ears (Gollum leaves with red tips), Aloe Vera |

### B. Aspect Ratio, Framing & Vertical Safety
- **Aspect Ratio:** Strictly `1:1` square (`AspectRatio: '1:1'`).
- **Shot Distance:** Medium close-up to macro. The primary botanical subject must occupy **65%–80% of the frame**.
- **Vertical Safety:** Keep the defining botanical feature in the upper/center two-thirds of the frame. Avoid placing critical subject details at the very bottom 20% edge where the front-card dark gradient panel and `Log` button overlay the photo.

### C. Lighting & Color Science
- **Indoor Houseplants (`group: 'indoor'`):** Specify `soft, bright indirect natural indoor lighting` or `soft ambient daylight`. Never use harsh flash, blown-out specular highlights, or artificial CGI lighting.
- **Outdoor Container / Garden Plants (`group: 'outdoor-potted' | 'outdoor-garden'`):** Specify `warm morning sunlight` or `bright natural outdoor garden sunlight with soft background bokeh`.
- **Foliage Health:** Always include `pristine, healthy, clean, glossy foliage without dust, water spots, or blemishes`.

### D. Context & Realism Anchors
- Anchor the plant in a believable setting: a clean minimalist ceramic planter (indoor), authentic terracotta pot (outdoor-potted), raised garden bed soil (outdoor-garden), or gritty pumice/perlite/lava rock mix (succulents).
- Maintain a clean, tasteful modern home or garden background with shallow depth of field (subtle bokeh) so the plant stands out without distractions.

### E. Exact Botanical Cultivar Specificity
Always include **both** the common name and the precise Latin scientific name / cultivar in the prompt:
- `Ficus elastica 'Burgundy'` instead of "Rubber plant"
- `Pilea spruceana 'Silver Tree'` instead of "Friendship plant"
- `Catharanthus roseus` instead of "Periwinkle"
- `Crassula ovata 'Gollum'` instead of "Ogre ears succulent"

---

## 2. Proven Prompt Templates

```text
# 1. Foliage Houseplant Template
"A high-quality close-up photorealistic photograph focusing on a healthy <Common Name> (<Latin Scientific Name & Cultivar>). The plant features pristine, <specific leaf texture, venation, marbling, or sheen details>. Potted in a clean modern minimalist ceramic planter, bathed in soft bright indirect natural indoor lighting with a clean tasteful background and shallow depth of field. Professional interior botanical photography, 1:1 square aspect ratio."

# 2. Flowering Plant Template
"A high-quality close-up photorealistic macro photograph of vibrant <Common Name> (<Latin Scientific Name & Cultivar>) flower clusters. The <specific petal shape, color, and inflorescence structure> is in sharp focus in the center-upper frame, set against healthy glossy green foliage in soft warm natural sunlight with gentle background bokeh. Professional botanical photography, 1:1 square aspect ratio."

# 3. Fruit / Vegetable Crop Template
"A high-quality close-up photorealistic photograph of a healthy developing <Common Name> (<Latin Scientific Name & Cultivar>) growing on the plant in a raised garden bed. The <specific fruit/curd/root texture and color> is clearly visible in sharp focus, surrounded by lush healthy green leaves in warm natural morning garden sunlight. Realistic botanical outdoor photography, 1:1 square aspect ratio."
```

---

## 3. Step-by-Step Execution & S3 Upload Workflow

### Step 1: Propose Prompt & Generate Image
1. Draft the tailored `1:1` prompt following Section 1 & Section 2.
2. Invoke the `image-generator` subagent to generate the `1:1` square photograph and save/convert it to JPEG at:
   ```text
   apps/plants/public/plants/<id>.jpg
   ```
   *(If the generator outputs PNG/WebP, convert it to high-quality JPEG `.jpg` so the file matches `imageUrl: '/plants/<id>.jpg'`.)*

### Step 2: Visual Vetting with User
1. Copy the generated image into the conversation's artifact directory (`<appDataDir>/brain/<conversation-id>/<id>.jpg`) and embed it in your response so the user can inspect the botanical accuracy and framing.
2. Wait for the user's explicit approval before uploading to S3/CloudFront.

### Step 3: Upload to S3 & Invalidate CloudFront
Once the user approves the image, upload `apps/plants/public/plants/<id>.jpg` to **both** production S3 buckets and invalidate CloudFront so the image goes live immediately at `https://plants.abhijeetkharkar.com/plants/<id>.jpg` (while also keeping `apps/plants/public/plants/<id>.jpg` committed in Git so future frontend deployments retain it):

```powershell
# 1. Upload to the active CloudFront origin bucket (plants-frontend-prod-797884421713)
aws s3 cp "apps/plants/public/plants/<id>.jpg" "s3://plants-frontend-prod-797884421713/plants/<id>.jpg" --content-type "image/jpeg" --region us-east-1 --profile admin

# 2. Upload to the dedicated catalog images bucket (plants-catalog-images-prod-797884421713)
aws s3 cp "apps/plants/public/plants/<id>.jpg" "s3://plants-catalog-images-prod-797884421713/plants/<id>.jpg" --content-type "image/jpeg" --region us-east-1 --profile admin

# 3. Invalidate /plants/<id>.jpg on the Plants CloudFront distribution (EH59GI05MOM4F)
aws cloudfront create-invalidation --distribution-id EH59GI05MOM4F --paths "/plants/<id>.jpg" --region us-east-1 --profile admin
```
*(Note: If the CloudFront Distribution ID ever changes, query it via `aws cloudformation describe-stacks --stack-name plants-stack-prod --region us-east-1 --profile admin --query "Stacks[0].Outputs[?OutputKey=='PlantsDistributionId'].OutputValue" --output text`.)*
