import api from './client';
import type { OnboardingLesson, OnboardingProgress } from '../types';

export async function getOnboardingLessons(): Promise<OnboardingLesson[]> {
  const response = await api.get<OnboardingLesson[]>('/kb/onboarding/');
  return response.data;
}

export async function completeLesson(lessonId: string): Promise<void> {
  await api.post(`/kb/onboarding/${lessonId}/complete/`);
}

export async function uncompleteLesson(lessonId: string): Promise<void> {
  await api.delete(`/kb/onboarding/${lessonId}/complete/`);
}

export async function getOnboardingProgress(): Promise<OnboardingProgress> {
  const response = await api.get<OnboardingProgress>('/kb/onboarding/progress/');
  return response.data;
}
