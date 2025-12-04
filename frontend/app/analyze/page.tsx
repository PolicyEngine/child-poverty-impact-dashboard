'use client';

import { useState } from 'react';
import ReformForm from '@/components/ReformForm';
import ResultsDisplay from '@/components/ResultsDisplay';
import { useFullAnalysis } from '@/hooks/useAnalysis';
import type { ReformRequest, AnalysisResponse } from '@/lib/types';

export default function AnalyzePage() {
  const [results, setResults] = useState<AnalysisResponse | null>(null);
  const { mutate: runAnalysis, isPending, error } = useFullAnalysis();

  const handleSubmit = (reform: ReformRequest) => {
    runAnalysis(reform, {
      onSuccess: (data) => {
        setResults(data);
      },
    });
  };

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Policy Analysis</h1>
        <p className="text-gray-600">
          Configure policy reforms and analyze their impact on child poverty
        </p>
      </div>

      <div className="grid lg:grid-cols-5 gap-8">
        {/* Reform Form */}
        <div className="lg:col-span-2">
          <ReformForm onSubmit={handleSubmit} isLoading={isPending} />
        </div>

        {/* Results */}
        <div className="lg:col-span-3">
          {isPending && (
            <div className="card text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-policyengine-blue mx-auto mb-4"></div>
              <p className="text-gray-600">Running analysis...</p>
              <p className="text-sm text-gray-400 mt-2">
                This may take a few moments for complex reforms
              </p>
            </div>
          )}

          {error && (
            <div className="card bg-red-50 border border-red-200">
              <h3 className="text-red-700 font-semibold mb-2">Analysis Error</h3>
              <p className="text-red-600">
                {(error as Error).message || 'An error occurred during analysis'}
              </p>
            </div>
          )}

          {results && !isPending && <ResultsDisplay results={results} />}

          {!results && !isPending && !error && (
            <div className="card text-center py-12 text-gray-500">
              <div className="text-4xl mb-4">📊</div>
              <h3 className="text-lg font-medium mb-2">Configure a Reform</h3>
              <p>Enable at least one policy reform and click "Run Analysis" to see results</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
