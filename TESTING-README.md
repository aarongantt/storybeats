# Testing Workflow for StoryBeats

## For the Business Partner (Tester)

### Your Mission:
Test StoryBeats thoroughly and report all bugs, suggestions, and ideas for improvement.

### What You Need:
1. **[TESTING-GUIDE.md](./TESTING-GUIDE.md)** ← **START HERE**
   - Complete step-by-step testing checklist
   - Follow each section in order
   - Check off items as you test
   - Take notes in the provided spaces

2. **OpenAI API Key**
   - Get it from [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
   - Make sure you have billing set up (at least $5 in credits)

3. **Live URL**
   - [Aaron will provide this - it's the production Vercel URL]

### How to Report Issues:
**Email Aaron** using the templates in TESTING-GUIDE.md for:
- 🐛 Bugs
- ✨ Feature Requests
- 💡 Improvements
- 📝 Content/Copy Changes

### Timeline:
- **Start:** [Aaron fills this in]
- **Complete by:** [Aaron fills this in]

### Questions?
Contact Aaron directly.

---

## For Aaron (Project Owner)

### Your Workflow:

1. **Send to Partner:**
   - Share the [live production URL]
   - Share TESTING-GUIDE.md
   - Give them a deadline

2. **As Feedback Comes In:**
   - Copy feedback into FEEDBACK-TRACKER.md
   - Categorize and prioritize
   - Decide what to implement

3. **For Implementation:**
   - Tag Claude in this conversation
   - Reference the specific issue from FEEDBACK-TRACKER.md
   - Claude will implement, test, commit, and push
   - Vercel auto-deploys

4. **After Deployment:**
   - Update FEEDBACK-TRACKER.md with status
   - Notify partner of fixes
   - Repeat

### Quick Commands:

**To implement an issue:**
```
Claude, implement Bug #3 from FEEDBACK-TRACKER.md
```

**To check deployment:**
```
Claude, verify the latest changes are deployed to production
```

**To add a new feature:**
```
Claude, add Feature #1 from FEEDBACK-TRACKER.md - [describe the feature]
```

---

## Files in This Testing System:

- **TESTING-GUIDE.md** - Complete testing checklist for partner
- **FEEDBACK-TRACKER.md** - Your tracking document for all feedback
- **TESTING-README.md** - This file - overview of the workflow

---

**System created by:** Claude Sonnet 4.5
**Purpose:** Streamline feedback collection and implementation for StoryBeats alpha testing
