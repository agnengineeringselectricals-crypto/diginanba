import { buildMarkdownAsset, buildProductBrief, evaluateQuality, scoreResearchOpportunity, validateMarkdownAsset, type ResearchOpportunity } from './domain.ts';
import type { CostClass } from './policy.ts';

export type LocalCapability='opportunity_score'|'product_brief'|'markdown_guide'|'markdown_validation'|'quality_evaluation';
export interface AgentProvider {
  readonly key:string;
  readonly costClass:CostClass;
  readonly capabilities:readonly LocalCapability[];
  execute<TInput,TOutput>(capability:LocalCapability,input:TInput):TOutput;
}

export class ProviderRequiredError extends Error {
  readonly capability:string;
  constructor(capability:string){super(`No authorized provider is configured for ${capability}.`);this.capability=capability;}
}

const deterministic:AgentProvider={
  key:'diginanba-local-deterministic',
  costClass:'FREE',
  capabilities:['opportunity_score','product_brief','markdown_guide','markdown_validation','quality_evaluation'],
  execute<TInput,TOutput>(capability:LocalCapability,input:TInput):TOutput {
    let output:unknown;
    switch(capability){
      case 'opportunity_score': output=scoreResearchOpportunity(input as ResearchOpportunity);break;
      case 'product_brief': output=buildProductBrief(input as ResearchOpportunity);break;
      case 'markdown_guide': output=buildMarkdownAsset(input as ReturnType<typeof buildProductBrief>);break;
      case 'markdown_validation': {
        const value=input as {bytes:Uint8Array;mimeType:string;fileName:string};
        output=validateMarkdownAsset(value.bytes,value.mimeType,value.fileName);break;
      }
      case 'quality_evaluation': {
        const value=input as {brief:ReturnType<typeof buildProductBrief>;asset:ReturnType<typeof validateMarkdownAsset>};
        output=evaluateQuality(value.brief,value.asset);break;
      }
    }
    return output as TOutput;
  },
};

export class ProviderRegistry {
  private readonly providers=new Map<string,AgentProvider>();
  register(provider:AgentProvider){this.providers.set(provider.key,provider);}
  resolve(key:string,capability:LocalCapability){
    const provider=this.providers.get(key);
    if(!provider||!provider.capabilities.includes(capability)) throw new ProviderRequiredError(capability);
    return provider;
  }
  execute<TInput,TOutput>(key:string,capability:LocalCapability,input:TInput){
    return this.resolve(key,capability).execute<TInput,TOutput>(capability,input);
  }
}

export const providers=new ProviderRegistry();
providers.register(deterministic);
export const deterministicProvider=deterministic;
