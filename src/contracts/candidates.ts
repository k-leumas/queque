import { z } from 'zod';

export const commandCandidateSchema = z.object({
  command: z.string().min(1),
  explanation: z.string(),
});

export type CommandCandidate = z.infer<typeof commandCandidateSchema>;

export const candidateListSchema = z.array(commandCandidateSchema).min(1).max(5);

export type CandidateList = z.infer<typeof candidateListSchema>;
