// Load Google Fonts once at module level — Remotion blocks rendering until ready.
// Using Cormorant Garamond (display) + Jost (body) to match the DuLichCali app.
import { loadFont as loadCormorant } from "@remotion/google-fonts/CormorantGaramond";
import { loadFont as loadJost } from "@remotion/google-fonts/Jost";

export const { fontFamily: displayFont } = loadCormorant("normal", {
  weights: ["300", "400"],
  subsets: ["latin", "latin-ext"], // latin-ext includes Vietnamese diacritics
});

export const { fontFamily: bodyFont } = loadJost("normal", {
  weights: ["300", "400", "500", "600"],
  subsets: ["latin", "latin-ext"],
});
