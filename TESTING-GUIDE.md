# StoryBeats Testing Guide

**Version:** 1.0
**Last Updated:** January 28, 2026

## Getting Started

**Live URL:** [Get from Aaron - it's the production Vercel URL]
**Your Role:** Test the app thoroughly and report any bugs, suggestions, or improvements

---

## Before You Begin

### What You'll Need:
- ✅ OpenAI API Key (from platform.openai.com/api-keys)
- ✅ OpenAI account with billing set up (at least $5 in credits)
- ✅ Chrome, Firefox, or Safari browser
- ✅ A story idea to test with

### First Time Setup:
1. Open the live URL
2. Enter your OpenAI API key
3. Click "Save and Continue"
4. If you get an error, see the "Troubleshooting" section at the bottom

---

## Testing Checklist

Work through each section below. Check off ✅ when working correctly, mark ❌ if broken, and note any issues.

### 1. API Key Setup
- [ ] **Enter invalid key** - Should show clear error message
- [ ] **Enter valid key** - Should validate and let you in
- [ ] **Click Reset button** (red button at top) - Should clear everything and restart

**Notes:**
```
[Write any issues or observations here]
```

---

### 2. Welcome Screen
- [ ] App shows "StoryBeats" branding
- [ ] Instructions are clear
- [ ] "Start Your Story" button works

**Notes:**
```
[Write any issues or observations here]
```

---

### 3. Initial Input Screen
- [ ] Can enter story idea in text box
- [ ] Example prompts rotate (watch for 10 seconds)
- [ ] "Continue" button is disabled when empty
- [ ] Can submit story idea
- [ ] Loading indicator appears during processing
- [ ] Story Bible populates on the left (debug panel)

**Test Story Ideas:**
Try at least 2 different story types:
1. Simple: "A detective solves a murder in a small town"
2. Complex: "In 2157, a rogue AI threatens to destroy Earth unless a team of hackers can infiltrate its quantum core and convince it that humanity is worth saving"

**Notes:**
```
[Write any issues or observations here]
```

---

### 4. Format Confirmation Screen
- [ ] All format options work (Film, TV, Book, Comic, Play, Short, Vertical)
- [ ] Can select multiple genres
- [ ] Can select multiple tones
- [ ] Can add custom genre
- [ ] Can add custom tone
- [ ] Theme field is optional (can skip it)
- [ ] World field works
- [ ] World description field works
- [ ] "Back" button works
- [ ] "Continue to Questions" button works

**Notes:**
```
[Write any issues or observations here]
```

---

### 5. Quick Interview Screen
- [ ] Questions appear one at a time
- [ ] Questions are relevant to your story
- [ ] Can type custom answers
- [ ] "Give me an idea!" button generates AI answer options
- [ ] Can select from AI answer chips
- [ ] "Skip" button works
- [ ] "Continue to Timeline" appears after enough questions
- [ ] Story Bible updates as you answer questions
- [ ] Question counter shows progress (e.g., "Question 3 of 10")

**Watch For:**
- Does AI ask good questions?
- Do questions make sense based on previous answers?
- Are there duplicate/repetitive questions?

**Notes:**
```
[Write any issues or observations here]
```

---

### 6. Timeline Builder Screen
- [ ] Shows all 12 beats
- [ ] Progress bar shows completion percentage
- [ ] Each beat card can expand/collapse
- [ ] "Write It" button lets you manually write a beat
- [ ] "Give me an idea!" generates AI alternatives (3-5 options)
- [ ] Can select from AI alternatives
- [ ] Can edit beat summary directly
- [ ] "Clear" button removes beat content
- [ ] "Lock" button prevents editing
- [ ] "Unlock" works on locked beats
- [ ] "Regenerate" creates new alternatives
- [ ] Can't continue until 50% complete (6+ beats)
- [ ] "Continue" button appears when ≥50% complete
- [ ] Status indicators show beat state (empty/incomplete/complete)

**Watch For:**
- Are AI-generated beats specific to your story?
- Do beats use actual character names from your Story Bible?
- Do beats reference your actual setting/conflict?
- Are beats too generic or vague?

**Notes:**
```
[Write any issues or observations here]
```

---

### 7. What's Next Screen
- [ ] "Generate Your Pitch" button works
- [ ] "Keep Building" returns to Timeline Builder

**Notes:**
```
[Write any issues or observations here]
```

---

### 8. Pitch Generator Screen
- [ ] "Generate Pitch Package" button works
- [ ] Loading indicator appears during generation
- [ ] Four tabs appear: Logline, Short Synopsis, One-Page, Outline
- [ ] Logline tab shows 1-sentence summary
- [ ] Short Synopsis tab shows 1 paragraph
- [ ] One-Page tab shows 3-4 paragraphs
- [ ] Outline tab shows numbered beat outline
- [ ] Copy button works for each format
- [ ] "Regenerate" creates new versions
- [ ] "Back to Menu" returns to What's Next

**Watch For:**
- Does the pitch accurately reflect your story?
- Is it compelling and well-written?
- Are character names consistent?

**Notes:**
```
[Write any issues or observations here]
```

---

### 9. Debug Panels (Left & Right Sidebars)

**Story Bible Panel (Left):**
- [ ] Shows protagonist details
- [ ] Shows world details
- [ ] Shows conflict details
- [ ] Shows theme
- [ ] Updates in real-time as you work

**Token Usage Panel (Right):**
- [ ] Shows token usage for each AI call
- [ ] Shows cost per operation
- [ ] Shows running total cost

**Notes:**
```
[Write any issues or observations here]
```

---

### 10. Reset Button (Red button at top center)
- [ ] Button is visible on all screens (after API key entry)
- [ ] Clicking shows confirmation or immediately resets
- [ ] Clears all data (Story Bible, beats, projects)
- [ ] Returns to API key entry screen
- [ ] All data is gone (can't recover after reset)

**Notes:**
```
[Write any issues or observations here]
```

---

## Additional Testing

### Error Handling
Try to break things:
- [ ] Enter gibberish as story idea
- [ ] Submit empty forms
- [ ] Refresh page mid-process - does state persist?
- [ ] Close and reopen app - does it remember your progress?

**Notes:**
```
[Write any issues or observations here]
```

---

### Performance
- [ ] AI responses come back within 10 seconds
- [ ] App doesn't freeze or lag
- [ ] No slow-downs after extended use

**Notes:**
```
[Write any issues or observations here]
```

---

### Content Quality
- [ ] AI-generated content is relevant and specific
- [ ] No generic placeholder content (e.g., "The protagonist wants to achieve their goal")
- [ ] Character names are used consistently
- [ ] Story details are preserved throughout the flow

**Notes:**
```
[Write any issues or observations here]
```

---

## Reporting Issues

### How to Report a Bug 🐛

**Email Aaron with this template:**

```
SUBJECT: [BUG] Brief description

WHAT HAPPENED:
[Describe what went wrong]

STEPS TO REPRODUCE:
1. Go to...
2. Click on...
3. Enter...
4. See error

EXPECTED BEHAVIOR:
[What should have happened instead]

ACTUAL BEHAVIOR:
[What actually happened]

SCREENSHOT:
[Attach screenshot if possible]

BROWSER:
[Chrome, Firefox, Safari, etc.]

STORY IDEA USED:
[What story were you testing with]
```

---

### How to Suggest a Feature ✨

**Email Aaron with this template:**

```
SUBJECT: [FEATURE] Brief description

FEATURE REQUEST:
[Describe the feature you want]

WHY IT'S NEEDED:
[Explain the problem this solves or value it adds]

HOW IT SHOULD WORK:
[Describe how you imagine it working]

PRIORITY:
[ ] Must-have for launch
[ ] Nice to have
[ ] Future consideration
```

---

### How to Suggest an Improvement 💡

**Email Aaron with this template:**

```
SUBJECT: [IMPROVEMENT] Brief description

CURRENT BEHAVIOR:
[What happens now]

SUGGESTED IMPROVEMENT:
[How it could be better]

WHY:
[Why this would be better]
```

---

### How to Suggest Content/Copy Changes 📝

**Email Aaron with this template:**

```
SUBJECT: [CONTENT] Brief description

CURRENT TEXT:
"[exact text currently shown]"

SUGGESTED TEXT:
"[your suggested replacement]"

LOCATION:
[Where in the app this appears]

WHY:
[Why this change would be better]
```

---

## Troubleshooting

### "Failed to process your story idea. Please check your OpenAI API key."

**Possible Causes:**
1. **Invalid API key** → Check you copied it correctly from platform.openai.com/api-keys
2. **Insufficient credits** → Add billing/credits to your OpenAI account
3. **No access to GPT-4o** → Check your OpenAI account has access to GPT-4 models

**How to Fix:**
1. Go to [platform.openai.com/settings/organization/billing](https://platform.openai.com/settings/organization/billing)
2. Add a payment method
3. Add at least $5 in credits or enable auto-recharge
4. Wait 5 minutes for OpenAI to process
5. In StoryBeats, click the red "Reset" button
6. Enter your API key again

---

### "Rate limit exceeded"

**Cause:** You're making too many requests too fast

**How to Fix:**
- Wait 60 seconds
- Try again

---

### App is Slow or Unresponsive

**How to Fix:**
1. Refresh the page
2. Clear your browser cache
3. Try a different browser
4. Check your internet connection

---

### Lost My Progress

**Unfortunately:**
- All data is stored in your browser's localStorage
- If you cleared cache, data is gone
- No cloud backup currently exists

**Prevention:**
- Don't clear browser cache while working
- Copy important content (Story Bible, beats) to a document as you work
- Complete the full workflow in one session

---

## Final Notes

### Expected Timeline
**Please complete testing by:** [Aaron will fill this in]

### Questions?
Email Aaron or message him directly

### Thank You!
Your feedback is critical to making StoryBeats better. We appreciate your time and detailed notes!

---

**Created by:** Claude Sonnet 4.5
**For:** StoryBeats Alpha Testing
