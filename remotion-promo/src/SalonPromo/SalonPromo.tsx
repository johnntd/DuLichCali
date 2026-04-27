import React from "react";
import { AbsoluteFill, Series } from "remotion";
import { SalonPromoProps } from "./schema";
import { Scene1Intro } from "./components/Scene1Intro";
import { Scene2Services } from "./components/Scene2Services";
import { Scene3Ambiance } from "./components/Scene3Ambiance";
import { Scene4CTA } from "./components/Scene4CTA";

// Scene durations @ 30fps:
//   Scene 1 Intro     : 105f  (3.5s)
//   Scene 2 Services  : 195f  (6.5s)
//   Scene 3 Ambiance  :  90f  (3.0s)
//   Scene 4 CTA       : 105f  (3.5s)
// With 3 × 15-frame crossfades:
//   105 + (195-15) + (90-15) + (105-15) = 105 + 180 + 75 + 90 = 450 ✓

const SCENE1_DUR = 105;
const SCENE2_DUR = 195;
const SCENE3_DUR =  90;
const SCENE4_DUR = 105;
const OVERLAP    =  15;

export const SalonPromo: React.FC<SalonPromoProps> = (props) => {
  return (
    <AbsoluteFill style={{ background: "#06000f" }}>
      <Series>
        <Series.Sequence durationInFrames={SCENE1_DUR}>
          <Scene1Intro {...props} />
        </Series.Sequence>

        <Series.Sequence durationInFrames={SCENE2_DUR} offset={-OVERLAP}>
          <Scene2Services {...props} />
        </Series.Sequence>

        <Series.Sequence durationInFrames={SCENE3_DUR} offset={-OVERLAP}>
          <Scene3Ambiance {...props} />
        </Series.Sequence>

        <Series.Sequence durationInFrames={SCENE4_DUR} offset={-OVERLAP}>
          <Scene4CTA {...props} />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};
