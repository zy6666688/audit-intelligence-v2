/**
 * PromptTemplate测试
 * Week 3 Day 1
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PromptTemplate, PromptTemplateLibrary, defaultTemplates } from './PromptTemplate';

describe('PromptTemplate', () => {
  describe('基本功能', () => {
    it('应该渲染简单模板', () => {
      const template = new PromptTemplate('Hello {{name}}!');
      const result = template.render({ name: 'World' });
      expect(result).toBe('Hello World!');
    });

    it('应该处理多个变量', () => {
      const template = new PromptTemplate('{{greeting}} {{name}}!');
      const result = template.render({
        greeting: 'Hi',
        name: 'Alice'
      });
      expect(result).toBe('Hi Alice!');
    });

    it('应该处理数字变量', () => {
      const template = new PromptTemplate('Count: {{count}}');
      const result = template.render({ count: 42 });
      expect(result).toBe('Count: 42');
    });
  });

  describe('变量提取', () => {
    it('应该提取所有变量', () => {
      const template = new PromptTemplate('{{a}} and {{b}} and {{c}}');
      const variables = template.getVariables();
      expect(variables).toHaveLength(3);
      expect(variables).toContain('a');
      expect(variables).toContain('b');
      expect(variables).toContain('c');
    });

    it('应该去重变量', () => {
      const template = new PromptTemplate('{{name}} {{name}} {{name}}');
      const variables = template.getVariables();
      expect(variables).toHaveLength(1);
      expect(variables[0]).toBe('name');
    });
  });

  describe('变量验证', () => {
    it('应该验证必需变量', () => {
      const template = new PromptTemplate('{{a}} {{b}}');
      const validation = template.validate({ a: 'test', b: 'test' });
      expect(validation.valid).toBe(true);
      expect(validation.missing).toHaveLength(0);
    });

    it('应该检测缺失变量', () => {
      const template = new PromptTemplate('{{a}} {{b}} {{c}}');
      const validation = template.validate({ a: 'test' });
      expect(validation.valid).toBe(false);
      expect(validation.missing).toContain('b');
      expect(validation.missing).toContain('c');
    });
  });
});

describe('PromptTemplateLibrary', () => {
  let library: PromptTemplateLibrary;

  beforeEach(() => {
    library = new PromptTemplateLibrary();
  });

  describe('模板管理', () => {
    it('应该注册和获取模板', () => {
      library.register('test', 'Hello {{name}}');
      const template = library.get('test');
      expect(template).toBeDefined();
    });

    it('应该列出所有模板', () => {
      library.register('tpl1', 'Test 1');
      library.register('tpl2', 'Test 2');
      const list = library.list();
      expect(list).toHaveLength(2);
      expect(list).toContain('tpl1');
      expect(list).toContain('tpl2');
    });

    it('应该删除模板', () => {
      library.register('test', 'Test');
      expect(library.remove('test')).toBe(true);
      expect(library.get('test')).toBeUndefined();
    });

    it('应该清空模板库', () => {
      library.register('tpl1', 'Test 1');
      library.register('tpl2', 'Test 2');
      library.clear();
      expect(library.list()).toHaveLength(0);
    });
  });

  describe('模板渲染', () => {
    it('应该渲染已注册模板', () => {
      library.register('greet', 'Hello {{name}}!');
      const result = library.render('greet', { name: 'World' });
      expect(result).toBe('Hello World!');
    });

    it('未找到模板应该抛出错误', () => {
      expect(() => {
        library.render('nonexistent', {});
      }).toThrow('not found');
    });
  });
});

describe('默认模板库', () => {
  it('应该包含默认模板', () => {
    const templates = defaultTemplates.list();
    expect(templates.length).toBeGreaterThan(0);
    expect(templates).toContain('summarize');
    expect(templates).toContain('analyze_data');
    expect(templates).toContain('audit_check');
  });

  it('应该渲染summarize模板', () => {
    const result = defaultTemplates.render('summarize', {
      content: 'Test content',
      maxLength: 100
    });
    expect(result).toContain('Test content');
    expect(result).toContain('100');
  });
});
