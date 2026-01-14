declare module 'leo-profanity' {
  const LeoProfanity: {
    loadDictionary: (dictionary: string) => void;
    add: (words: string[]) => void;
    clean: (input: string) => string;
    isProfane: (input: string) => boolean;
  };

  export default LeoProfanity;
}
