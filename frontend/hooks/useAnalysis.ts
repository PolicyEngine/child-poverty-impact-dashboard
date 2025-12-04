'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import {
  runFullAnalysis,
  runPovertyAnalysis,
  runFiscalAnalysis,
  runDistributionalAnalysis,
  getPresetReforms,
  validateReform,
  getAllStates,
  compareStates,
} from '@/lib/api';
import type { ReformRequest } from '@/lib/types';

export function useFullAnalysis() {
  return useMutation({
    mutationFn: runFullAnalysis,
  });
}

export function usePovertyAnalysis() {
  return useMutation({
    mutationFn: runPovertyAnalysis,
  });
}

export function useFiscalAnalysis() {
  return useMutation({
    mutationFn: runFiscalAnalysis,
  });
}

export function useDistributionalAnalysis() {
  return useMutation({
    mutationFn: runDistributionalAnalysis,
  });
}

export function usePresetReforms() {
  return useQuery({
    queryKey: ['presetReforms'],
    queryFn: getPresetReforms,
  });
}

export function useValidateReform() {
  return useMutation({
    mutationFn: validateReform,
  });
}

export function useStates() {
  return useQuery({
    queryKey: ['states'],
    queryFn: getAllStates,
  });
}

export function useStateComparison() {
  return useMutation({
    mutationFn: ({ reform, states }: { reform: ReformRequest; states?: string[] }) =>
      compareStates(reform, states),
  });
}
