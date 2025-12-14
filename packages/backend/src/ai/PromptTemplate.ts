/**
 * PromptTemplate - 提示词模板系统
 * Week 3 Day 1
 * 
 * 支持变量替换和模板管理
 */

/**
 * 模板变量
 */
export type TemplateVariables = Record<string, string | number | boolean>;

/**
 * 提示词模板
 */
export class PromptTemplate {
  private template: string;
  private variables: string[] = [];

  constructor(template: string) {
    this.template = template;
    this.extractVariables();
  }

  /**
   * 渲染模板
   */
  render(variables: TemplateVariables): string {
    let result = this.template;

    for (const [key, value] of Object.entries(variables)) {
      const pattern = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
      result = result.replace(pattern, String(value));
    }

    return result;
  }

  /**
   * 验证变量
   */
  validate(variables: TemplateVariables): { valid: boolean; missing: string[] } {
    const provided = Object.keys(variables);
    const missing = this.variables.filter(v => !provided.includes(v));

    return {
      valid: missing.length === 0,
      missing
    };
  }

  /**
   * 获取所需变量
   */
  getVariables(): string[] {
    return [...this.variables];
  }

  /**
   * 提取模板中的变量
   */
  private extractVariables(): void {
    const pattern = /\{\{\s*(\w+)\s*\}\}/g;
    const found = new Set<string>();
    let match;

    while ((match = pattern.exec(this.template)) !== null) {
      found.add(match[1]);
    }

    this.variables = Array.from(found);
  }
}

/**
 * 提示词模板库
 */
export class PromptTemplateLibrary {
  private templates: Map<string, PromptTemplate> = new Map();

  /**
   * 注册模板
   */
  register(name: string, template: string | PromptTemplate): void {
    const tpl = typeof template === 'string' ? new PromptTemplate(template) : template;
    this.templates.set(name, tpl);
  }

  /**
   * 获取模板
   */
  get(name: string): PromptTemplate | undefined {
    return this.templates.get(name);
  }

  /**
   * 渲染模板
   */
  render(name: string, variables: TemplateVariables): string {
    const template = this.templates.get(name);
    if (!template) {
      throw new Error(`Template "${name}" not found`);
    }
    return template.render(variables);
  }

  /**
   * 列出所有模板
   */
  list(): string[] {
    return Array.from(this.templates.keys());
  }

  /**
   * 删除模板
   */
  remove(name: string): boolean {
    return this.templates.delete(name);
  }

  /**
   * 清空模板库
   */
  clear(): void {
    this.templates.clear();
  }
}

/**
 * 默认模板库
 */
export const defaultTemplates = new PromptTemplateLibrary();

// 注册默认模板
defaultTemplates.register(
  'summarize',
  `请总结以下内容：

{{content}}

要求：
- 简洁明了
- 突出重点
- 不超过{{maxLength}}字`
);

defaultTemplates.register(
  'analyze_data',
  `请分析以下数据：

{{data}}

分析维度：
{{dimensions}}

请提供：
1. 数据概况
2. 关键发现
3. 潜在问题
4. 建议`
);

defaultTemplates.register(
  'audit_check',
  `作为审计专家，请检查以下内容：

项目：{{project}}
检查项：{{checkItem}}
数据：{{data}}

请按照审计准则评估，指出：
1. 合规性问题
2. 风险等级
3. 改进建议`
);
