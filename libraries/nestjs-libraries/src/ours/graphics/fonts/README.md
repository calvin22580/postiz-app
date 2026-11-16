# Graphic fonts

Plus Jakarta Sans (SIL Open Font License 1.1, see `OFL.txt`), the same typeface
the app uses (`apps/frontend/src/fonts/plus-jakarta-sans`).

The two `.ttf` files are static instances (weights 500 and 800) of that
variable font, made with fontTools so the image renderer (sharp / Pango) can
load them by file without any fonts installed on the server:

```
fonttools varLib.instancer PlusJakartaSans.woff2 wght=800 --static
```

then saved as TrueType with the subfamily names `Medium` and `ExtraBold`.
