import type { JobSource } from "../types";
import { remoteOkSource } from "./remoteok";
import { hnHiringSource } from "./hn-hiring";
import { hnJobsSource } from "./hn-jobs";

export const sources: JobSource[] = [hnHiringSource, remoteOkSource, hnJobsSource];
