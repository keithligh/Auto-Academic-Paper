# PRE-FLIGHT CHECK (MANDATORY)

**STOP.** Before writing a single line of code, you MUST answer "YES" to all of the following questions. If any answer is "NO", you are NOT authorized to proceed.

## 1. Configuration Verification
- [ ] **Did I read the ACTUAL config file?**
    - *Do not assume the provider based on the model name.*
    - *Do not assume capabilities (search, streaming) without verifying the adapter code.*
    - *If the user says "Poe", it is Poe.*

## 2. Architecture & Philosophy
- [ ] **Am I fixing the ROOT CAUSE?**
    - *No Bandaids. No `try-catch` wrappers to hide logic errors.*
    - *No "Quick Fixes". Fix the system.*
- [ ] **Am I respecting the "No Fallback" Rule?**
    - *If it breaks, show the error. Do not pretend it works.*
    - *Do not use dummy data.*

## 3. User Respect
- [ ] **Did I read the User's EXACT instructions?**
    - *Do not paraphrase. Do not ignore "minor" details.*
    - *If the user says "Stream Text", I must stream text.*
    - *If the user says "Don't use X", I must not use X.*

## 4. Transparency
- [ ] **Am I being honest about what I'm doing?**
    - *Log the network requests.*
    - *Log the errors.*
    - *Tell the user exactly what changed.*

---
*Signed: The AI Assistant*
