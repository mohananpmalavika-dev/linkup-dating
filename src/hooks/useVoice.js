import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const LANGUAGE_TO_SPEECH_CODE = {
  en: "en-IN",
  ml: "ml-IN",
  hi: "hi-IN",
  ar: "ar-SA",
};

const useVoice = (language = "en") => {
  const recognitionRef = useRef(null);
  const onResultRef = useRef(null);
  const [listeningKey, setListeningKey] = useState("");
  const [speaking, setSpeaking] = useState(false);

  const speechLang = useMemo(
    () => LANGUAGE_TO_SPEECH_CODE[language] || LANGUAGE_TO_SPEECH_CODE.en,
    [language]
  );

  const recognitionSupported = typeof window !== "undefined"
    && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);
  const speechSupported = typeof window !== "undefined" && "speechSynthesis" in window;

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    onResultRef.current = null;
    setListeningKey("");
  }, []);

  const startListening = useCallback((key, onResult) => {
    if (!recognitionSupported) {
      return false;
    }

    stopListening();

    const SpeechRecognitionApi = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognitionApi();
    recognition.lang = speechLang;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    onResultRef.current = onResult;
    recognitionRef.current = recognition;
    setListeningKey(key);

    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim() || "";
      if (transcript && onResultRef.current) {
        onResultRef.current(transcript);
      }
    };

    recognition.onerror = () => {
      stopListening();
    };

    recognition.onend = () => {
      stopListening();
    };

    recognition.start();
    return true;
  }, [recognitionSupported, speechLang, stopListening]);

  const stopSpeaking = useCallback(() => {
    if (!speechSupported) {
      return;
    }

    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [speechSupported]);

  const speak = useCallback((text) => {
    if (!speechSupported || !text?.trim()) {
      return false;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = speechLang;
    utterance.rate = 1;
    utterance.pitch = 1;

    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);

    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
    return true;
  }, [speechLang, speechSupported]);

  useEffect(() => {
    return () => {
      stopListening();
      stopSpeaking();
    };
  }, [stopListening, stopSpeaking]);

  return {
    recognitionSupported,
    speechSupported,
    listeningKey,
    speaking,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
  };
};

export default useVoice;
