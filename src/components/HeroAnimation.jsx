import React, { useState } from "react";
import { Typewriter } from "react-typewriter";
import { styles } from "../styles";

const CoolAnimatedText = () => {
  const [showComputer, setShowComputer] = useState(true);

  const toggleText = () => {
    setShowComputer((prev) => !prev);
  };

  return (
    <p className={`${styles.heroSubText} mt-2 text-white-100`}>
      I am{" "}
      <Typewriter
        onTypingEnd={toggleText}
        cursor={null}
        delay={75}
        string={showComputer ? "a computer" : "a political scientist"}
      />
      <br className="sm:block hidden" />
    </p>
  );
};

export default CoolAnimatedText;
