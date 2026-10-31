import React, { useState, useRef } from 'react';
import { Sparkles, ArrowRight, Image as ImageIcon, X, Lightbulb, Compass, Zap, BookOpen } from 'lucide-react';
import { ConceptCategory } from '../../types/visualization';

interface Props {
  onVisualize: (prompt: string, imageBase64?: string) => void;
  isLoading: boolean;
}

const EXAMPLE_PROMPTS = [
  {
    category: 'physics',
    label: 'Projectile Motion',
    prompt: 'Visualize projectile motion and trajectory with launch angle, velocity, and gravity parameters.',
  },
  {
    category: 'computer_science',
    label: 'Binary Search Algorithm',
    prompt: 'Explain binary search visually with low, mid, and high pointers operating over an array.',
  },
  {
    category: 'machine_learning',
    label: 'Gradient Descent Optimization',
    prompt: 'Show how gradient descent minimizes a loss function curve with learning rate and iteration steps.',
  },
  {
    category: 'system_process',
    label: 'TCP Three-Way Handshake',
    prompt: 'Explain the TCP three-way handshake connection establishment with SYN, SYN-ACK, and ACK message flows.',
  },
  {
    category: 'mathematics',
    label: 'Fourier Harmonics & Sine Waves',
    prompt: 'Visualize harmonic wave superposition and frequency decomposition with amplitude and frequency sliders.',
  },
  {
    category: 'engineering',
    label: 'CPU Instruction Pipeline',
    prompt: 'Explain how a 5-stage CPU pipeline works with Instruction Fetch, Decode, Execute, Memory, and Writeback.',
  },
];

export const LandingHero: React.FC<Props> = ({ onVisualize, isLoading }) => {
  const [prompt, setPrompt] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() && !imagePreview) return;
    onVisualize(prompt, imagePreview || undefined);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    // Validate size (< 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Please upload an image smaller than 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImagePreview(null);
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-12 md:py-20 flex flex-col items-center text-center">
      {/* Editorial Kicker */}
      <div className="flex items-center gap-2 text-xs font-medium text-smoke-600 mb-4 tracking-wide uppercase font-mono">
        <span>Universal STEM & Systems Engine</span>
        <span aria-hidden="true">·</span>
        <span>AI-Generated Declarative Models</span>
      </div>

      {/* Main Title */}
      <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-smoke-950 font-display max-w-3xl leading-tight">
        Turn complex concepts into <span className="text-smoke-600 italic">interactive visual</span> understanding.
      </h1>

      {/* Tagline */}
      <p className="mt-4 text-sm sm:text-base text-smoke-600 max-w-xl leading-relaxed">
        Understand concepts by seeing them. Enter a natural language question, formula, textbook excerpt, or upload a diagram to generate a live interactive model.
      </p>

      {/* Input Box Form */}
      <form onSubmit={handleSubmit} className="mt-8 w-full max-w-2xl bg-white rounded-2xl border border-smoke-200 shadow-sm p-3 focus-within:border-smoke-500 focus-within:ring-2 focus-within:ring-smoke-200/50 transition-all text-left">
        {/* Uploaded Image Preview if any */}
        {imagePreview && (
          <div className="mb-3 relative inline-block">
            <img
              src={imagePreview}
              alt="Uploaded concept diagram"
              className="h-20 w-auto rounded-lg border border-smoke-200 object-cover"
            />
            <button
              type="button"
              onClick={removeImage}
              className="absolute -top-1.5 -right-1.5 bg-smoke-800 text-white rounded-full p-0.5 hover:bg-black transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {uploadError && (
          <div className="mb-2 text-xs text-rose-600 font-medium">
            {uploadError}
          </div>
        )}

        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ask anything: 'Visualize projectile motion', 'Explain TCP handshake', 'Show gradient descent', or paste textbook text..."
          rows={3}
          className="w-full text-sm sm:text-base text-smoke-900 placeholder:text-smoke-400 bg-transparent border-none resize-none focus:outline-hidden"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
        />

        {/* Bottom Bar: Image upload button + Submit button */}
        <div className="flex items-center justify-between border-t border-smoke-100 pt-2.5 mt-1">
          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageUpload}
              accept="image/png, image/jpeg, image/webp"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-smoke-600 hover:text-smoke-900 hover:bg-smoke-50 border border-smoke-200 transition-colors cursor-pointer"
            >
              <ImageIcon className="w-3.5 h-3.5 text-smoke-500" />
              <span>Upload Image / Diagram</span>
            </button>
          </div>

          <button
            type="submit"
            disabled={isLoading || (!prompt.trim() && !imagePreview)}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold text-white bg-smoke-800 hover:bg-smoke-900 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xs cursor-pointer"
          >
            {isLoading ? (
              <span>Designing Model...</span>
            ) : (
              <>
                <span>Visualize</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </form>

      {/* Quick Example Prompts */}
      <div className="mt-8 w-full max-w-2xl text-left">
        <div className="flex items-center gap-2 text-xs font-semibold text-smoke-500 uppercase tracking-wider mb-2.5 font-mono">
          <Lightbulb className="w-3.5 h-3.5 text-smoke-500" />
          <span>Try Concept Prompts</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {EXAMPLE_PROMPTS.map((ex, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setPrompt(ex.prompt);
                onVisualize(ex.prompt);
              }}
              className="text-left p-3 rounded-xl bg-white/80 hover:bg-white border border-smoke-200/80 hover:border-smoke-400 text-xs text-smoke-800 transition-all shadow-xs group"
            >
              <span className="font-semibold text-smoke-950 block mb-0.5 group-hover:text-smoke-600 transition-colors">
                {ex.label}
              </span>
              <span className="text-smoke-500 text-[11px] line-clamp-1">{ex.prompt}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
