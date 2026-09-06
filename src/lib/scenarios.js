// Starter Studio scenarios — used by scripts/seed-scenarios.mjs (local) and /api/admin/seed (production).
const PROFILE_TAKEOVER_TEMPLATE = `15秒，竖屏。仅使用用户上传的 X（Twitter）个人资料页面截图作为唯一的背景和布局参考。

保持原图的头部图像、个人资料头像位置、白色UI背景、各个按钮、图标、屏幕布局、留白、颜色、比例。
相机完全固定。不对屏幕本身进行缩放、平移、旋转或重新布局。
除指定演出外，不改变UI或背景。

将个人资料头像圆形内的人物作为唯一的角色参考。该人物的外貌：{character}
在15秒内完全保持其五官、发型、发色、头饰、服装、配饰、真实质感和电影质感，与头像完全一致。
禁止卡通化、2D化、3D化、换人化、服装变更。
角色最初与头像完全相同，手作手枪状。

【0.0～2.4秒】
整个屏幕完全固定为原图状态。仅个人资料头像的圆形内部开始动作。
角色转过头看了一眼镜头，右手拨了一下头发，双眼紧盯镜头，皱起眉头。

【2.4～4.0秒】
角色双手抓住头像的圆形边框，把圆形头像当作小入口，从中跳出来往外走。
先一只脚，再另一只脚，自然地伸向屏幕侧，然后直接降落到个人资料页面的白色留白部分。
只有角色从头像中出来。个人资料页面本身不发生变形。原有的圆形头像保持原位不动。

【4.0～8.2秒】
着陆的角色发现屏幕内的文字，仔细察看资料。
以个人资料名称、用户ID、自我介绍、链接文字、加入年月、关注数、粉丝数、订阅标记、按钮内文字、帖子内文字、时间和电池数字等屏幕内所有可读文本/字母/数字为目标。
角色像剥纸质贴纸一样，用指尖一个个轻轻剥下文字，当场揉成皱巴巴的小纸团，"啪"地朝镜头扔过来。
纸团朝相机前方飞来，在前景处消失到屏幕外。
重复"剥下 → 揉成团 → 扔向镜头"的动作，第1次、第2次、第3次……节奏活泼。
每次扔出后，该文字从原位置消失，变成白色留白。
仅剥文字。头部图像、头像边框、人物图像、UI图形图标、按钮形状、分隔线等非文字元素全部保留。
纸团不要太大，不遮挡整个屏幕。

【8.2～10.4秒】
角色环顾四周，露出"还有剩下的"的表情，从腰间拔出一把道具手枪对准文字开了一枪，页面出现一个弹孔，许多文字被震落。
再连开两枪，页面再增加两个弹孔，剩余文字全部被震落到地上。
角色用手指抠下最后一个文字。屏幕上的文字信息全部清除，只剩大片白色留白和三个弹孔。

【10.4～11.2秒】
角色把手枪放入口袋，摸索一番，取出一支粗黑的马克笔，"啪"地摘掉笔帽，转向变白的留白。

【11.2～13.7秒】
角色用黑色马克笔，在个人资料页面中央至下方的大片留白上，大大地手写：
{text}
字符串必须精确显示为「{text}」。禁止拼写变更、缺字、乱码，不要添加多余文字。
黑色粗体手写马克笔字体，一笔一画从笔尖自然写出，足够大、清晰易读，大胆利用留白。

【13.7～15.0秒】
角色合上笔帽，满意地注视自己的涂鸦，然后转肩面向镜头，微微眯眼，露出"成功了！"的狡黠而愉快的冷峻微笑（不是大张嘴大笑）。
最后以「{text}」黑色大字和转头微笑的角色同时清晰可见的构图静止约0.7秒结束。

【动作・演出】
节奏感强的喜剧动画。角色动作轻快有弹性，背景页面始终固定。
剥文字时明确表现纸张翻起剥离的感觉；揉团时指尖捏成小纸球的动作清晰可见；扔向镜头时带前景远近感。
开枪动作轻快但不激烈，不使用烟雾或华丽特效遮挡屏幕。可视性最优先。

【重要固定事项】
・仅使用上传截图作为视觉参考；相机完全固定；不改变原截图的构图、头部图像、UI布局
・在指定前不随意变更或删除文字；前半部分逐个剥下文字揉成团扔向镜头；后半部分开枪震落清理剩余文字
・最后不留任何原文字；仅移除文字，保留非文字的UI图形与图像
・最终仅保留新文字「{text}」
・保持角色的脸庞、头发、头饰、服装与头像一致的真人质感；不卡通化、不3D化、不换人
・不增加手指、胳膊、腿；手枪和马克笔不增殖；不添加多余人物；不生成新徽标或句子；禁止文字乱码
・无台词、旁白、对话气泡`;

export const SCENARIOS = [
  {
    slug: "profile-takeover",
    name: "Profile Page Takeover",
    description: "Upload an X / Twitter profile screenshot. The person in the avatar climbs out, strips every word off the page, shoots the rest down and graffitis your line across it. 15 s, vertical, H3 Max.",
    sortOrder: 5,
    config: {
      modelEndpoint: "minimax/h3-max/image-to-video",
      systemPrompt: "",
      promptTemplate: PROFILE_TAKEOVER_TEMPLATE,
      showPrompt: false,
      requireImage: true,
      duration: 15,
      resolution: "768P",
      aspectRatio: "",
      creditCost: 180,
      theme: "midnight",
      visionModel: "google/gemini-2.5-flash",
      userParams: [
        {
          key: "character",
          label: "Person in the avatar (auto-detected — fix it if wrong)",
          type: "textarea",
          defaultValue: "",
          required: true,
          autofill: "vision",
          autofillInstruction:
            "这是一张社交媒体（X / Twitter）个人资料页面的截图。只看圆形头像里的人物，用一句中文描述其外貌：性别、大致年龄、发型与发色、是否戴帽子或眼镜、上衣类型与颜色、明显配饰，以及是真人照片还是插画。不要描述背景、页面文字或其他区域。只输出这一句描述。",
          placeholder: "Upload the screenshot and we'll describe the avatar for you…",
          help: "This goes into the video prompt so the character stays consistent.",
        },
        {
          key: "text",
          label: "What should they write on the page?",
          type: "text",
          defaultValue: "",
          required: true,
          placeholder: "我是小羽!",
          help: "Short works best: a name, a slogan, 2–12 characters.",
        },
      ],
    },
  },
  {
    slug: "photo-to-life",
    name: "Bring a Photo to Life",
    description: "Upload any photo — a portrait, a pet, a landscape — and H3 Max animates it with natural, subtle motion. Optional: tell it what should move.",
    sortOrder: 10,
    config: {
      modelEndpoint: "minimax/h3-max/image-to-video",
      systemPrompt: "Animate this photo with subtle, natural, realistic motion. Keep the subject's identity, the original framing and lighting. Gentle camera drift.",
      promptLabel: "What should move? (optional)",
      promptPlaceholder: "e.g. she smiles and the wind moves her hair",
      showPrompt: true,
      requireImage: true,
      duration: 5,
      resolution: "768P",
      aspectRatio: "",
      creditCost: 60,
      theme: "slate-indigo",
      userParams: [],
    },
  },
  {
    slug: "product-showcase",
    name: "Product Showcase",
    description: "Turn one product photo into a 5-second commercial shot: slow orbit, studio lighting, premium feel. Made for shop pages and ads.",
    sortOrder: 20,
    config: {
      modelEndpoint: "minimax/h3-max/image-to-video",
      systemPrompt: "Cinematic product commercial: the camera slowly orbits the product, soft studio lighting with gentle highlights, clean background, premium advertising look, no text.",
      promptLabel: "Anything specific? (optional)",
      promptPlaceholder: "e.g. light reflections on the glass, warm tone",
      showPrompt: true,
      requireImage: true,
      duration: 5,
      resolution: "768P",
      aspectRatio: "",
      creditCost: 60,
      theme: "midnight",
      userParams: [],
    },
  },
  {
    slug: "vertical-social-clip",
    name: "Vertical Social Clip",
    description: "A 9:16 clip for TikTok, Reels and Shorts from a single sentence. Energetic pacing, vivid colors, fast on H3 Max Turbo.",
    sortOrder: 30,
    config: {
      modelEndpoint: "minimax/h3-max-turbo/text-to-video",
      systemPrompt: "Vertical short-form social video, energetic pacing, vibrant saturated colors, punchy camera movement, trending aesthetic.",
      promptLabel: "Describe the clip",
      promptPlaceholder: "e.g. a barista pouring latte art in a sunlit café",
      showPrompt: true,
      duration: 5,
      resolution: "768P",
      aspectRatio: "9:16",
      creditCost: 30,
      theme: "cyberpunk",
      userParams: [],
    },
  },
  {
    slug: "cinematic-text-to-video",
    name: "Cinematic Text to Video",
    description: "Full-quality H3 Max at 768P, 16:9, 5 to 15 seconds. Film-grade lighting and camera work from your description.",
    sortOrder: 40,
    config: {
      modelEndpoint: "minimax/h3-max/text-to-video",
      systemPrompt: "Cinematic film still brought to life: film-grade lighting, shallow depth of field, deliberate camera movement, rich color grading.",
      promptLabel: "Describe the scene",
      promptPlaceholder: "e.g. a lighthouse keeper watches a storm roll in at dusk",
      showPrompt: true,
      duration: "",
      resolution: "768P",
      aspectRatio: "16:9",
      creditCost: 0,
      theme: "slate-indigo",
      userParams: [
        { key: "duration", label: "Length", type: "slider", defaultValue: 5, min: 5, max: 15, step: 1, costPerUnit: 12 },
      ],
    },
  },
  {
    slug: "character-reference",
    name: "Consistent Character",
    description: "Upload 1–3 reference images of a character and describe the shot. H3 Max keeps the look consistent across your clips.",
    sortOrder: 50,
    config: {
      modelEndpoint: "minimax/h3-max/reference-to-video",
      systemPrompt: "Keep the character's face, hairstyle, outfit and proportions exactly consistent with the reference images.",
      promptLabel: "Describe the shot",
      promptPlaceholder: "e.g. Image 1 walks through a neon night market, medium shot",
      showPrompt: true,
      duration: 5,
      resolution: "768P",
      aspectRatio: "16:9",
      creditCost: 60,
      theme: "sunset",
      userParams: [
        { key: "reference_image_urls", label: "Character references", type: "image_list", defaultValue: [], maxInputs: 3, help: "Refer to them in your text as Image 1, Image 2…" },
      ],
    },
  },
  {
    slug: "quick-draft",
    name: "Quick Draft",
    description: "The cheapest way to test an idea: H3 Max Turbo at 480P, 5 seconds, 16:9. Iterate on the prompt here, then upgrade.",
    sortOrder: 60,
    config: {
      modelEndpoint: "minimax/h3-max-turbo/text-to-video",
      systemPrompt: "",
      promptLabel: "Describe the clip",
      promptPlaceholder: "Anything — this is the sandbox",
      showPrompt: true,
      duration: 5,
      resolution: "480P",
      aspectRatio: "16:9",
      creditCost: 20,
      theme: "emerald",
      userParams: [],
    },
  },
];
