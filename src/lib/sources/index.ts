import type { JobSource } from "../types";
import { remoteOkSource } from "./remoteok";
import { hnHiringSource } from "./hn-hiring";
import { hnJobsSource } from "./hn-jobs";
import { remotiveSource } from "./remotive";
import { jobicySource } from "./jobicy";
import { himalayasSource } from "./himalayas";
import { wwrSource } from "./wwr";

export const sources: JobSource[] = [hnHiringSource, remoteOkSource, hnJobsSource, remotiveSource, jobicySource, himalayasSource, wwrSource];
