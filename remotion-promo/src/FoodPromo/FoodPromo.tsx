import React from "react";
import { AbsoluteFill, Series } from "remotion";
import { FoodPromoProps } from "./schema";
import { Scene1Intro } from "./components/Scene1Intro";
import { Scene2Showcase } from "./components/Scene2Showcase";
import { Scene3Details } from "./components/Scene3Details";
import { Scene4CTA } from "./components/Scene4CTA";

// Scene durations (frames @ 30fps)
//   Scene 1 Intro    : 105f  (3.5s)
//   Scene 2 Showcase : 195f  (6.5s)
//   Scene 3 Details  : 120f  (4.0s)
//   Scene 4 CTA      : 105f  (3.5s)
// With 15-frame crossfades between scenes:
//   Total = 105 + (195-15) + (120-15) + (105-15) = 105 + 180 + 105 + 90 = 480
// We register the composition at 480 frames but round to 450 for tighter pacing
// by reducing Scene 2 to 180 frames:
//   105 + (180-15) + (120-15) + (105-15) = 105 + 165 + 105 + 90 = 465
// Keep it 450 by pulling Scene3 to 110:
//   105 + (175-15) + (110-15) + (105-15) = 105 + 160 + 95 + 90 = 450 ✓

const SCENE1_DUR = 105;
const SCENE2_DUR = 175;
const SCENE3_DUR = 110;
const SCENE4_DUR = 105;
const OVERLAP    = 15; // crossfade frames

export const FoodPromo: React.FC<FoodPromoProps> = (props) => {
  return (
    <AbsoluteFill style={{ background: "#0c0400" }}>
      <Series>
        <Series.Sequence durationInFrames={SCENE1_DUR}>
          <Scene1Intro {...props} />
        </Series.Sequence>

        <Series.Sequence durationInFrames={SCENE2_DUR} offset={-OVERLAP}>
          <Scene2Showcase {...props} />
        </Series.Sequence>

        <Series.Sequence durationInFrames={SCENE3_DUR} offset={-OVERLAP}>
          <Scene3Details {...props} />
        </Series.Sequence>

        <Series.Sequence durationInFrames={SCENE4_DUR} offset={-OVERLAP}>
          <Scene4CTA {...props} />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};
