import React, { useState } from 'react';
import { getApiEndpoint } from '../utils/api.js';

const LearningPathView = ({ path, onStart, onClose }) => {
  const [rating, setRating] = useState(0);
  const [hasRated, setHasRated] = useState(false);
  
  if (!path) return null;

  const handleRate = async (stars) => {
    if (!path._id) return; // Only rate saved paths
    
    try {
      const response = await fetch(getApiEndpoint(`/api/learning-paths/${path._id}/rate`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: stars })
      });
      
      if (response.ok) {
        setRating(stars);
        setHasRated(true);
      }
    } catch (error) {
      console.error('Error rating path:', error);
    }
  };

  const formatTime = (minutes) => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case 'beginner':
        return 'bg-green-500';
      case 'intermediate':
        return 'bg-yellow-500';
      case 'advanced':
        return 'bg-red-500';
      default:
        return 'bg-blue-500';
    }
  };

  const getDifficultyIcon = (difficulty) => {
    switch (difficulty) {
      case 'beginner':
        return '🌱';
      case 'intermediate':
        return '🚀';
      case 'advanced':
        return '🎯';
      default:
        return '📚';
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[80vh] overflow-hidden flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 p-6 text-white">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">{getDifficultyIcon(path.difficulty)}</span>
              <span className="text-xs font-semibold uppercase tracking-wider bg-white/20 px-2 py-1 rounded">
                {path.difficulty}
              </span>
              {path.source === 'ai_generated' && (
                <span className="text-xs font-semibold uppercase tracking-wider bg-white/20 px-2 py-1 rounded">
                  ✨ AI Generated
                </span>
              )}
              {path.source === 'saved' && (
                <span className="text-xs font-semibold uppercase tracking-wider bg-white/20 px-2 py-1 rounded">
                  💾 Saved Path
                </span>
              )}
              {path.usageCount > 0 && (
                <span className="text-xs font-semibold uppercase tracking-wider bg-white/20 px-2 py-1 rounded">
                  👥 {path.usageCount} users
                </span>
              )}
            </div>
            <h2 className="text-2xl font-bold mb-2">{path.title}</h2>
            <p className="text-white/90 text-sm">{path.description}</p>
          </div>
          <button
            onClick={onClose}
            className="ml-4 text-white/80 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="flex items-center gap-6 mt-4 text-sm">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{formatTime(path.totalEstimatedMinutes)}</span>
          </div>
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{path.steps.length} Steps</span>
          </div>
        </div>
      </div>

      {/* Steps */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="space-y-4">
          {path.steps.map((step, index) => (
            <div
              key={step.id}
              className="relative pl-8 pb-8 last:pb-0"
            >
              {/* Timeline line */}
              {index < path.steps.length - 1 && (
                <div className="absolute left-4 top-8 bottom-0 w-0.5 bg-gradient-to-b from-indigo-500 to-purple-500" />
              )}
              
              {/* Step number circle */}
              <div className="absolute left-0 top-0 w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm shadow-lg">
                {index + 1}
              </div>
              
              {/* Step content */}
              <div className="bg-gray-50 rounded-xl p-4 ml-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-gray-900 text-lg">{step.title}</h3>
                  <span className="text-xs text-gray-500 ml-2 whitespace-nowrap">
                    {formatTime(step.estimatedMinutes)}
                  </span>
                </div>
                
                {step.description && (
                  <p className="text-gray-700 text-sm mb-2">{step.description}</p>
                )}
                
                {step.rationale && (
                  <div className="bg-blue-50 border-l-4 border-blue-400 p-3 rounded">
                    <p className="text-xs text-gray-600">
                      <span className="font-semibold text-blue-700">Why this step: </span>
                      {step.rationale}
                    </p>
                  </div>
                )}
                
                {step.metadata && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded">
                      {step.metadata.subject}
                    </span>
                    {step.metadata.section && (
                      <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
                        {step.metadata.section}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 p-6 bg-gray-50">
        {/* Rating Section (for saved paths) */}
        {path._id && !hasRated && (
          <div className="mb-4 pb-4 border-b border-gray-200">
            <p className="text-sm text-gray-600 mb-2">Rate this learning path:</p>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => handleRate(star)}
                  className="text-2xl transition-transform hover:scale-110"
                >
                  {star <= rating ? '⭐' : '☆'}
                </button>
              ))}
            </div>
          </div>
        )}
        
        {hasRated && (
          <div className="mb-4 pb-4 border-b border-gray-200">
            <p className="text-sm text-green-600">✓ Thanks for rating!</p>
          </div>
        )}
        
        {path.averageRating > 0 && (
          <div className="mb-4 pb-4 border-b border-gray-200">
            <p className="text-sm text-gray-600">
              Average rating: <span className="font-semibold">{path.averageRating.toFixed(1)}</span> ⭐
              {path.ratings?.length > 0 && ` (${path.ratings.length} ratings)`}
            </p>
          </div>
        )}
        
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Ready to begin your learning journey?
          </div>
          <button
            onClick={onStart}
            className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          >
            Start Learning Path
          </button>
        </div>
      </div>
    </div>
  );
};

export default LearningPathView;

