import React, { useState, useRef, useEffect } from 'react';
import { VisualizationPlan, ChatMessage } from '../../types/visualization';
import { BookOpen, ListOrdered, Binary, Network, MessageSquare, HelpCircle, Send, CheckCircle2, XCircle } from 'lucide-react';
import { askFollowUpTutor } from '../../services/api';
import { MarkdownRenderer } from '../common/MarkdownRenderer';

interface Props {
  plan: VisualizationPlan;
  currentStep?: number;
  onSelectStep?: (step: number) => void;
}

type TabType = 'overview' | 'steps' | 'equations' | 'entities' | 'tutor' | 'quiz';

export const ExplanationPanel: React.FC<Props> = ({
  plan,
  currentStep = 1,
  onSelectStep,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  // Follow-up AI Tutor State
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeTab === 'tutor') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, isChatLoading, activeTab]);

  // Quiz State
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
  const [showQuizResults, setShowQuizResults] = useState(false);

  const { explanation, equations = [], entities = [], relationships = [], steps = [], quiz = [] } = plan;

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatLoading) return;

    const userMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: chatInput.trim(),
      timestamp: new Date().toISOString(),
    };

    setChatHistory((prev) => [...prev, userMsg]);
    setChatInput('');
    setIsChatLoading(true);

    const { answer, error } = await askFollowUpTutor(plan, chatHistory, userMsg.content);

    const botMsg: ChatMessage = {
      id: `msg_bot_${Date.now()}`,
      role: 'assistant',
      content: answer || error || 'I could not generate an answer at this moment.',
      timestamp: new Date().toISOString(),
    };

    setChatHistory((prev) => [...prev, botMsg]);
    setIsChatLoading(false);
  };

  const handleSelectQuizOption = (questionId: string, optIndex: number) => {
    if (showQuizResults) return;
    setQuizAnswers((prev) => ({
      ...prev,
      [questionId]: optIndex,
    }));
  };

  const calculateScore = () => {
    let correct = 0;
    quiz.forEach((q) => {
      if (quizAnswers[q.id] === q.correct_index) correct++;
    });
    return { correct, total: quiz.length };
  };

  return (
    <div className="w-full h-full bg-white rounded-2xl border border-smoke-200 shadow-xs flex flex-col overflow-hidden">
      {/* Segmented Control Header */}
      <div className="p-2 border-b border-smoke-200 bg-smoke-50/70">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-white text-smoke-900 shadow-xs font-semibold'
                : 'text-smoke-600 hover:text-smoke-900'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Overview</span>
          </button>

          <button
            onClick={() => setActiveTab('steps')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'steps'
                ? 'bg-white text-smoke-900 shadow-xs font-semibold'
                : 'text-smoke-600 hover:text-smoke-900'
            }`}
          >
            <ListOrdered className="w-3.5 h-3.5" />
            <span>Steps ({steps.length})</span>
          </button>

          {equations.length > 0 && (
            <button
              onClick={() => setActiveTab('equations')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                activeTab === 'equations'
                  ? 'bg-white text-smoke-900 shadow-xs font-semibold'
                  : 'text-smoke-600 hover:text-smoke-900'
              }`}
            >
              <Binary className="w-3.5 h-3.5" />
              <span>Equations</span>
            </button>
          )}

          {entities.length > 0 && (
            <button
              onClick={() => setActiveTab('entities')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                activeTab === 'entities'
                  ? 'bg-white text-smoke-900 shadow-xs font-semibold'
                  : 'text-smoke-600 hover:text-smoke-900'
              }`}
            >
              <Network className="w-3.5 h-3.5" />
              <span>Entities</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('tutor')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'tutor'
                ? 'bg-white text-smoke-900 shadow-xs font-semibold'
                : 'text-smoke-600 hover:text-smoke-900'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Ask Tutor</span>
          </button>

          {quiz.length > 0 && (
            <button
              onClick={() => setActiveTab('quiz')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                activeTab === 'quiz'
                  ? 'bg-white text-smoke-900 shadow-xs font-semibold'
                  : 'text-smoke-600 hover:text-smoke-900'
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Test Me</span>
            </button>
          )}
        </div>
      </div>

      {/* Tab Content Container */}
      {activeTab === 'tutor' ? (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-white">
          {/* Scrollable Chat Messages Area */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-3.5 text-sm text-smoke-800">
            {chatHistory.length === 0 ? (
              <div className="text-center py-8 text-smoke-500 space-y-2">
                <MessageSquare className="w-7 h-7 mx-auto text-smoke-400" />
                <p className="text-xs">
                  Ask any follow-up question about this visualization, equations, or parameter interactions.
                </p>
                <div className="flex flex-wrap justify-center gap-1.5 pt-2">
                  <button
                    onClick={() => setChatInput('What happens if I double the primary parameter?')}
                    className="text-[11px] bg-smoke-50 hover:bg-smoke-100 text-smoke-700 px-2.5 py-1 rounded-md border border-smoke-200 transition-colors cursor-pointer"
                  >
                    "What happens if I double the primary parameter?"
                  </button>
                  <button
                    onClick={() => setChatInput('Explain the core intuition in simple terms.')}
                    className="text-[11px] bg-smoke-50 hover:bg-smoke-100 text-smoke-700 px-2.5 py-1 rounded-md border border-smoke-200 transition-colors cursor-pointer"
                  >
                    "Explain the core intuition simply"
                  </button>
                </div>
              </div>
            ) : (
              chatHistory.map((msg) => (
                <div
                  key={msg.id}
                  className={`p-3 rounded-xl text-xs leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-smoke-800 text-white ml-6 shadow-2xs'
                      : 'bg-smoke-100 text-smoke-900 mr-6 border border-smoke-200/80 shadow-2xs'
                  }`}
                >
                  <span className="font-bold block mb-1 font-mono text-[10px] opacity-75">
                    {msg.role === 'user' ? 'You' : 'AI Concept Tutor'}
                  </span>
                  <MarkdownRenderer content={msg.content} isUser={msg.role === 'user'} />
                </div>
              ))
            )}
            {isChatLoading && (
              <div className="p-3 rounded-xl bg-smoke-100 text-smoke-600 text-xs animate-pulse mr-6 border border-smoke-200/60">
                Reasoning with current visualization parameters...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Dedicated Fixed User Question Area at Bottom */}
          <div className="shrink-0 p-3 sm:p-3.5 bg-smoke-50/90 border-t border-smoke-200 backdrop-blur-xs">
            <form onSubmit={handleSendChat} className="flex items-center gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask about this model, equations, or parameters..."
                disabled={isChatLoading}
                className="flex-1 text-xs bg-white border border-smoke-200 rounded-lg px-3.5 py-2.5 text-smoke-900 placeholder:text-smoke-400 focus:outline-hidden focus:border-smoke-600 focus:ring-1 focus:ring-smoke-600 disabled:opacity-50 transition-all shadow-2xs"
              />
              <button
                type="submit"
                disabled={isChatLoading || !chatInput.trim()}
                className="p-2.5 rounded-lg bg-smoke-800 text-white hover:bg-smoke-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer shrink-0 shadow-2xs flex items-center justify-center"
                title="Send question to tutor"
                aria-label="Send question"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-sm text-smoke-800">
          {/* TAB: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-5">
            <div>
              <h3 className="text-xs font-semibold text-smoke-500 uppercase tracking-wider font-mono mb-1.5">
                Core Explanation
              </h3>
              <p className="text-smoke-800 leading-relaxed text-sm">{explanation.overview}</p>
            </div>

            {/* Beginner Final Walkthrough Outcome (if completed or available) */}
            {explanation.final_result && (
              <div className="bg-emerald-50/80 rounded-xl p-4 border border-emerald-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-emerald-900 uppercase font-mono tracking-wider">
                    Walkthrough Result
                  </span>
                  {explanation.final_result.final_answer && (
                    <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-md bg-emerald-700 text-white">
                      {explanation.final_result.final_answer}
                    </span>
                  )}
                </div>
                <p className="text-xs text-emerald-950 font-medium leading-relaxed">
                  {explanation.final_result.summary}
                </p>
                {explanation.final_result.conclusion && (
                  <p className="text-[11px] text-emerald-800 leading-relaxed">
                    {explanation.final_result.conclusion}
                  </p>
                )}
              </div>
            )}

            {explanation.key_points.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-smoke-500 uppercase tracking-wider font-mono mb-2">
                  Key Principles
                </h3>
                <ul className="space-y-2">
                  {explanation.key_points.map((pt, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs sm:text-sm text-smoke-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-smoke-500 mt-2 shrink-0" />
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {explanation.real_world_example && (
              <div className="bg-smoke-50 rounded-xl p-3.5 border border-smoke-200/80">
                <span className="text-[11px] font-semibold text-smoke-900 uppercase font-mono block mb-1">
                  Real-World Application
                </span>
                <p className="text-xs text-smoke-700 leading-relaxed">{explanation.real_world_example}</p>
              </div>
            )}
          </div>
        )}

        {/* TAB: STEPS */}
        {activeTab === 'steps' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-smoke-500 uppercase tracking-wider font-mono">
                Step-by-Step Walkthrough
              </h3>
              <span className="text-[11px] text-smoke-500 font-mono">Step {currentStep} of {steps.length}</span>
            </div>
            <div className="space-y-3">
              {steps.map((stepObj, idx) => {
                const stepNum = stepObj.step_number || idx + 1;
                const isActive = currentStep === stepNum;
                const expStep = explanation.step_by_step.find((s) => s.step === stepNum) || explanation.step_by_step[idx];
                const title = expStep?.title || stepObj.title || `Step ${stepNum}`;
                const textExplanation = expStep?.explanation || stepObj.description;
                const guidance = expStep?.guidance || stepObj.guidance;
                const takeaway = expStep?.takeaway;

                return (
                  <div
                    key={stepNum}
                    onClick={() => onSelectStep?.(stepNum)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer space-y-2.5 ${
                      isActive
                        ? 'bg-smoke-100/90 border-smoke-700 shadow-xs ring-1 ring-smoke-700'
                        : 'bg-smoke-50/80 border-smoke-200/80 hover:bg-smoke-100 hover:border-smoke-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-5 h-5 rounded-md text-[11px] font-mono font-bold flex items-center justify-center shrink-0 ${
                            isActive ? 'bg-smoke-800 text-white' : 'bg-smoke-300 text-smoke-800'
                          }`}
                        >
                          {stepNum}
                        </span>
                        <span className={`font-semibold text-xs ${isActive ? 'text-smoke-950' : 'text-smoke-900'}`}>
                          {title}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {stepObj.is_final_step && (
                          <span className="text-[10px] font-mono font-semibold uppercase px-1.5 py-0.5 rounded-md bg-emerald-700 text-white">
                            Complete
                          </span>
                        )}
                        {isActive && (
                          <span className="text-[10px] font-mono font-semibold uppercase px-1.5 py-0.5 rounded-md bg-smoke-800 text-white">
                            Active
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-smoke-800 pl-7 leading-relaxed font-medium">{textExplanation}</p>

                    {/* Beginner Structured 5-Question Explainer Card */}
                    {guidance && isActive && (
                      <div className="ml-7 mt-2 space-y-2 bg-white/95 rounded-lg p-3 border border-smoke-200 text-xs">
                        {guidance.what_is_happening && (
                          <div>
                            <span className="font-bold text-smoke-900 font-mono text-[10px] uppercase block text-smoke-500">
                              1. What is happening?
                            </span>
                            <span className="text-smoke-800">{guidance.what_is_happening}</span>
                          </div>
                        )}
                        {guidance.why_it_happens && (
                          <div>
                            <span className="font-bold text-smoke-900 font-mono text-[10px] uppercase block text-smoke-500">
                              2. Why is it happening?
                            </span>
                            <span className="text-smoke-800">{guidance.why_it_happens}</span>
                          </div>
                        )}
                        {guidance.what_changed && (
                          <div>
                            <span className="font-bold text-smoke-900 font-mono text-[10px] uppercase block text-smoke-500">
                              3. What changed?
                            </span>
                            <span className="text-smoke-800">{guidance.what_changed}</span>
                          </div>
                        )}
                        {guidance.what_to_notice && (
                          <div>
                            <span className="font-bold text-smoke-900 font-mono text-[10px] uppercase block text-smoke-500">
                              4. What should I notice?
                            </span>
                            <span className="text-smoke-800">{guidance.what_to_notice}</span>
                          </div>
                        )}
                        {guidance.what_next && (
                          <div>
                            <span className="font-bold text-smoke-900 font-mono text-[10px] uppercase block text-smoke-500">
                              5. What happens next?
                            </span>
                            <span className="text-smoke-800">{guidance.what_next}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {takeaway && (
                      <p className="text-[11px] text-smoke-600 pl-7 italic">Takeaway: {takeaway}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB: EQUATIONS */}
        {activeTab === 'equations' && (
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-smoke-500 uppercase tracking-wider font-mono">
              Mathematical Formulations
            </h3>
            {equations.map((eq) => (
              <div key={eq.id} className="p-4 rounded-xl bg-smoke-50 border border-smoke-200 space-y-3">
                <span className="text-xs font-semibold text-smoke-900 block">{eq.name}</span>
                <div className="bg-white p-3 rounded-lg border border-smoke-200 text-center font-mono text-sm text-smoke-900 shadow-2xs">
                  {eq.latex || eq.formula_text}
                </div>
                {eq.description && <p className="text-xs text-smoke-600">{eq.description}</p>}
                {eq.variables.length > 0 && (
                  <div className="border-t border-smoke-200/60 pt-2 space-y-1">
                    <span className="text-[10px] font-semibold text-smoke-500 uppercase font-mono block">
                      Variables
                    </span>
                    <div className="grid grid-cols-1 gap-1">
                      {eq.variables.map((v, vidx) => (
                        <div key={vidx} className="flex items-baseline gap-2 text-xs">
                          <span className="font-mono font-bold text-smoke-800">{v.symbol}</span>
                          <span className="text-smoke-400">·</span>
                          <span className="text-smoke-600">{v.meaning} {v.unit ? `(${v.unit})` : ''}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* TAB: ENTITIES */}
        {activeTab === 'entities' && (
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-smoke-500 uppercase tracking-wider font-mono">
              System Components & Entities
            </h3>
            <div className="grid grid-cols-1 gap-2.5">
              {entities.map((ent) => (
                <div key={ent.id} className="p-3 rounded-xl bg-smoke-50 border border-smoke-200 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-smoke-900">{ent.name}</span>
                    <span className="text-[10px] font-mono text-smoke-500">{ent.type}</span>
                  </div>
                  {ent.role && <p className="text-xs text-smoke-600 font-medium">Role: {ent.role}</p>}
                  {ent.description && <p className="text-xs text-smoke-500">{ent.description}</p>}
                </div>
              ))}
            </div>

            {relationships.length > 0 && (
              <div className="pt-2 space-y-2">
                <h3 className="text-xs font-semibold text-smoke-500 uppercase tracking-wider font-mono">
                  Interactions & Relationships
                </h3>
                {relationships.map((rel, ridx) => (
                  <div key={ridx} className="text-xs p-2.5 rounded-lg bg-white border border-smoke-200 flex items-start gap-2">
                    <span className="font-mono text-smoke-700 font-semibold">{rel.source}</span>
                    <span className="text-smoke-400">→</span>
                    <span className="font-medium text-smoke-600">{rel.relation}</span>
                    <span className="text-smoke-400">→</span>
                    <span className="font-mono text-smoke-700 font-semibold">{rel.target}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB: QUIZ */}
        {activeTab === 'quiz' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between border-b border-smoke-200 pb-2">
              <h3 className="text-xs font-semibold text-smoke-500 uppercase tracking-wider font-mono">
                Concept Mastery Check
              </h3>
              {showQuizResults && (
                <span className="text-xs font-bold text-smoke-900 font-mono">
                  Score: {calculateScore().correct} / {calculateScore().total}
                </span>
              )}
            </div>

            <div className="space-y-4">
              {quiz.map((q, qidx) => {
                const selectedOpt = quizAnswers[q.id];
                const isAnswered = selectedOpt !== undefined;
                const isCorrect = selectedOpt === q.correct_index;

                return (
                  <div key={q.id} className="p-4 rounded-xl bg-smoke-50 border border-smoke-200 space-y-3">
                    <p className="font-semibold text-xs text-smoke-900">
                      {qidx + 1}. {q.question}
                    </p>

                    <div className="space-y-1.5">
                      {q.options.map((opt, optIdx) => {
                        const isThisSelected = selectedOpt === optIdx;
                        let optionStyle = 'bg-white hover:bg-smoke-100 border-smoke-200 text-smoke-800';

                        if (showQuizResults) {
                          if (optIdx === q.correct_index) {
                            optionStyle = 'bg-emerald-50 border-emerald-400 text-emerald-900 font-medium';
                          } else if (isThisSelected && !isCorrect) {
                            optionStyle = 'bg-rose-50 border-rose-400 text-rose-900';
                          }
                        } else if (isThisSelected) {
                          optionStyle = 'bg-smoke-800 text-white border-smoke-800';
                        }

                        return (
                          <button
                            key={optIdx}
                            onClick={() => handleSelectQuizOption(q.id, optIdx)}
                            className={`w-full text-left p-2.5 rounded-lg border text-xs transition-colors flex items-center justify-between cursor-pointer ${optionStyle}`}
                          >
                            <span>{opt}</span>
                            {showQuizResults && optIdx === q.correct_index && (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            )}
                            {showQuizResults && isThisSelected && !isCorrect && (
                              <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {showQuizResults && (
                      <div className="p-2.5 rounded-lg bg-white border border-smoke-200 text-xs text-smoke-600 space-y-0.5">
                        <span className="font-semibold text-smoke-900 font-mono text-[10px] uppercase block">
                          Explanation
                        </span>
                        <p>{q.explanation}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="pt-2">
              {!showQuizResults ? (
                <button
                  onClick={() => setShowQuizResults(true)}
                  disabled={Object.keys(quizAnswers).length === 0}
                  className="w-full py-2.5 rounded-xl bg-smoke-800 text-white hover:bg-smoke-900 disabled:opacity-40 font-semibold text-xs transition-colors cursor-pointer shadow-xs"
                >
                  Submit & Check Answers
                </button>
              ) : (
                <button
                  onClick={() => {
                    setShowQuizResults(false);
                    setQuizAnswers({});
                  }}
                  className="w-full py-2 rounded-xl bg-smoke-100 text-smoke-800 hover:bg-smoke-200 font-medium text-xs transition-colors cursor-pointer"
                >
                  Reset Quiz
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    )}
  </div>
);
};
