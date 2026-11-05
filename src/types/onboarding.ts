export const QUESTION_IDS = ["q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8", "q9"] as const;
export const OPTION_IDS = ["q_opt1", "q_opt2", "q_opt3", "q_opt4"] as const;

type MapTuple<Tuple extends readonly unknown[], T> = { readonly [K in keyof Tuple]: T };
export type OptionsTuple<T> = MapTuple<typeof OPTION_IDS, T>;

export type QuestionId = (typeof QUESTION_IDS)[number];
export type OptionId = (typeof OPTION_IDS)[number];

export interface IOnBoardingQuestionnaireQuestion {
  questionId: QuestionId;
  content: string;
}

export interface IOnBoardingQuestionnaireOption {
  optionId: OptionId;
  content: string;
}

export interface IOnBoardingQuestionnaire {
  question: IOnBoardingQuestionnaireQuestion;
  options: IOnBoardingQuestionnaireOption[];
}

const questionsContent: Record<QuestionId, string> = {
  q1: "Wybierz język nauki",
  q2: "Gdy uczysz się czegoś nowego, co robisz najpierw?",
  q3: "Co najlepiej pomaga Ci zapamiętać?",
  q4: "Wolisz uczyć się...",
  q5: "Idealna nauka to dla Ciebie...",
  q6: "Jak rozwiązujesz problem?",
  q7: "Co Cię najbardziej motywuje?",
  q8: "Jak lubisz uczyć się języka?",
  q9: "Które zdanie pasuje do Ciebie najbardziej?",
};

const rawOptionsData: Record<QuestionId, OptionsTuple<string>> = {
  q1: ["Angielski", "Rosyjski", "Niemiecki", "Włoski"],
  q2: ["Obrazy", "Działanie", "Rozmowa", "Notatki"],
  q3: ["Oglądając", "Robiąc", "W grupie", "Analizując"],
  q4: ["Wizualne przykłady", "Ćwiczenia", "Praca zespołowa", "Logika i wyjaśnienia"],
  q5: ["Wyobrażam go sobie", "Testuję", "Pytam innych", "Analizuję"],
  q6: ["Ciekawy wygląd / forma", "Postęp i działanie", "Ludzie i kontakt", "Zrozumienie"],
  q7: ["Przez filmy", "Przez mówienie", "Przez rozmowy", "Przez zasady"],
  q8: ["Muszę to zobaczyć", "Muszę to zrobić", "Muszę to omówić", "Muszę to zrozumieć"],
  q9: ["Muszę to zobaczyć", "Muszę to zrobić", "Muszę to omówić", "Muszę to zrozumieć"],
};

export const QUESTIONS: IOnBoardingQuestionnaireQuestion[] = QUESTION_IDS.map((questionId) => ({
  questionId,
  content: questionsContent[questionId],
}));

export const onBoardingData: IOnBoardingQuestionnaire[] = QUESTIONS.map((question) => {
  const contents = rawOptionsData[question.questionId];

  return {
    question,
    options: OPTION_IDS.map((optionId, i): IOnBoardingQuestionnaireOption => ({
      optionId,
      content: contents[i] as string,
    })),
  };
});
