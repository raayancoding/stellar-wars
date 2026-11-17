import os, shutil
from PIL import Image

ROOT = r"C:\Users\san21\html_game\stellar-wars"
SRC = os.path.join(ROOT, "assets-to-use")
DST = os.path.join(ROOT, "assets")

dirs = [
    "lib", "models/players", "models/enemies", "models/bosses",
    "icons", "fonts", "textures"
]
for d in dirs:
    os.makedirs(os.path.join(DST, d), exist_ok=True)

# --- icons: trim transparent, pad, resize 256 ---
icons = {
    "heart": "Heart",
    "heart_half": "Heart_Half",
    "shield": "Crystal2",
    "shield_crystal": "Crystal5",
    "freeze": "Snowflake1",
    "time_slow": "Snowflake2",
    "star": "Star",
    "coin": "Coin",
    "coin_star": "Coin_Star",
    "extra_life": "Coin_Skull",
    "weapon": "Potion1_Filled_Blue",
    "weapon_rare": "Potion3_Filled",
    "missile": "Dart",
    "nuke": "Skull",
    "magnet": "Ring1",
    "orbital": "Scroll",
    "premium": "Crown",
    "gem": "Crystal1",
    "score": "Star",
    "speed": "Arrow",
    "potion_green": "Potion2_Filled",
    "potion_pink": "Potion4_Filled",
    "potion_gold": "Potion5_Filled",
    "potion_teal": "Potion6_Filled",
    "potion_red": "Potion1_Filled_Red",
    "sword": "Sword",
    "mineral": "Mineral",
    "crown": "Crown2",
    "chest": "Chest_Closed",
    "bone": "Bone",
    "ring2": "Ring2",
    "ring3": "Ring3",
    "coin_skull": "Coin_Skull",
    "heart_broken": "Heart_Broken",
    "snow3": "Snowflake3",
    "potion7": "Potion7_Filled",
    "potion8": "Potion8_Filled",
    "potion9": "Potion9_Filled",
    "potion10": "Potion10_Filled",
    "potion11": "Potion11_Filled",
    "crystal3": "Crystal3",
    "crystal4": "Crystal4",
}

icons_src = os.path.join(SRC, "Ultimate RPG Items Pack", "Icons")
for out_name, src_name in icons.items():
    path = os.path.join(icons_src, src_name + ".png")
    if not os.path.exists(path):
        print("MISSING ICON", src_name)
        continue
    im = Image.open(path).convert("RGBA")
    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)
    # square canvas with 6% padding
    side = max(im.size)
    pad = int(side * 0.06)
    canvas = Image.new("RGBA", (side + pad * 2, side + pad * 2), (0, 0, 0, 0))
    canvas.alpha_composite(im, ((canvas.width - im.width) // 2, (canvas.height - im.height) // 2))
    canvas = canvas.resize((256, 256), Image.LANCZOS)
    canvas.save(os.path.join(DST, "icons", out_name + ".png"), optimize=True)

# --- ship color textures resized ---
ship_tex = {
    "scout": ("Spitfire", "Blue"),
    "fighter": ("Striker", "Green"),
    "destroyer": ("Executioner", "Orange"),
    "titan": ("Imperial", "Purple"),
    "phantom": ("Omen", "Red"),
    "enemy_drone": ("Pancake", "Red"),
    "enemy_fighter": ("Bob", "Purple"),
    "enemy_bomber": ("Dispatcher", "Red"),
    "enemy_kamikaze": ("Insurgent", "Red"),
    "enemy_elite": ("Zenith", "Red"),
    "enemy_escort": ("Challenger", "Purple"),
}
for key, (model, color) in ship_tex.items():
    src = os.path.join(SRC, "Ultimate Spaceships", model, "Textures", f"{model}_{color}.png")
    im = Image.open(src).convert("RGBA")
    im = im.resize((512, 512), Image.LANCZOS)
    im.save(os.path.join(DST, "textures", f"{key}.png"), optimize=True)
    print("texture", key, os.path.getsize(os.path.join(DST, "textures", f"{key}.png")) // 1024, "KB")

# --- licenses ---
for pack in ["Ultimate Spaceships", "Ultimate Monsters", "Ultimate RPG Items Pack"]:
    src = os.path.join(SRC, pack, "License.txt")
    if os.path.exists(src):
        shutil.copyfile(src, os.path.join(DST, f"LICENSE_{pack.replace(' ', '_')}.txt"))

print("DONE")
