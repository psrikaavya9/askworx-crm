// ---------------------------------------------------------------------------
// Video Quiz — TypeScript types
// ---------------------------------------------------------------------------

export interface QuizQuestion {
  id:          string;
  question:    string;
  options:     string[];   // 4 choices
  order:       number;
  // correctIdx and explanation only sent after submit
  correctIdx?: number;
  explanation?: string;
}

export interface QuizSummary {
  id:        string;
  videoId:   string;
  passMark:  number;
  questions: QuizQuestion[];  // without correctIdx/explanation
}

export interface QuizAttempt {
  id:          string;
  videoId:     string;
  staffId:     string;
  score:       number;
  passed:      boolean;
  attemptedAt: string;
  answers:     Record<string, number>;
}

export interface QuizSubmitResult {
  score:          number;
  passed:         boolean;
  passMark:       number;
  attemptedAt:    string;
  totalQuestions: number;
  correctCount:   number;
  review: {
    questionId:  string;
    question:    string;
    yourAnswer:  number;
    correct:     number;
    isCorrect:   boolean;
    explanation?: string;
  }[];
}

export interface CreateQuizInput {
  videoId:   string;
  passMark?: number;
  questions: {
    question:    string;
    options:     string[];
    correctIdx:  number;
    explanation?: string;
    order?:      number;
  }[];
}
