import { defineStore } from 'pinia';
import { Language } from '@/utils/translator';
import { translator } from '@/utils/translator';

interface LanguageState {
  language: Language;
}

export const useLanguageStore = defineStore('language', {
  state: (): LanguageState => ({
    language: (localStorage.getItem('node-editor-language') as Language) || 'zh'
  }),

  getters: {
    isEnglish: (state) => state.language === 'en',
    isChinese: (state) => state.language === 'zh'
  },

  actions: {
    setLanguage(lang: Language) {
      this.language = lang;
      translator.setLanguage(lang);
      localStorage.setItem('node-editor-language', lang);
    },

    toggleLanguage() {
      const newLang = this.language === 'zh' ? 'en' : 'zh';
      this.setLanguage(newLang);
      return newLang;
    }
  }
});

