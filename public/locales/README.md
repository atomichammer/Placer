# Adding New Languages

This application supports internationalization (i18n) using JSON translation files. You can add new languages without recompiling the application!

## How to Add a New Language

1. **Create a new language folder** in `public/locales/`:
   ```
   public/locales/
   ├── en/
   │   └── translation.json
   ├── ru/
   │   └── translation.json
   └── [your-language-code]/
       └── translation.json
   ```

2. **Copy an existing translation file** (e.g., `en/translation.json`) to your new language folder.

3. **Translate all the values** (keep the keys unchanged):
   ```json
   {
     "app": {
       "title": "Your Translation Here"
     }
   }
   ```

4. **Add the language button** in `src/components/LanguageSwitcher.tsx`:
   ```tsx
   <button
     onClick={() => changeLanguage('your-language-code')}
     className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
       i18n.language === 'your-language-code'
         ? 'bg-white text-indigo-700'
         : 'bg-indigo-500 text-white hover:bg-indigo-400'
     }`}
     title="Your Language Name"
   >
     CODE
   </button>
   ```

5. **For deployment**: Simply upload the new translation file to your server in the `locales/[lang]/` directory. No rebuild needed!

## Language Codes

Use standard ISO 639-1 language codes:
- `en` - English
- `ru` - Russian (Русский)
- `de` - German (Deutsch)
- `fr` - French (Français)
- `es` - Spanish (Español)
- `zh` - Chinese (中文)
- `ja` - Japanese (日本語)
- etc.

## Translation File Structure

The translation file is organized into logical sections:
- `app` - Application-level strings
- `projectSetup` - Project creation screen
- `partsManager` - Parts management interface
- `placementView` - Visualization and results
- `statistics` - Statistics panel
- `projectSettings` - Settings modal
- `common` - Shared/common terms
- `validation` - Error messages and validation

## Dynamic Content

For pluralization, use the `_other` suffix:
```json
{
  "chipboardsUsed": "{{count}} chipboard used",
  "chipboardsUsed_other": "{{count}} chipboards used"
}
```

For interpolation with variables:
```json
{
  "partTooLarge": "Part dimensions ({{width}} × {{height}} mm) are too large!"
}
```

## Testing Your Translation

1. Add your translation file
2. Add the language switcher button (requires rebuild)
3. Run `npm run dev` locally or deploy
4. Click your language button to test

## Contributing Translations

If you've created a translation for a new language, please consider contributing it back to the project!

