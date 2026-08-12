1. [ ] I should be able to edit the portion sizes. And automatically, the macros should be updated according to the portion size.  
2. [x] The Enter button for going to the next question during onboarding is working only on questions where I enter with the keyboard some answer, but when I click the male or female button, the Enter button is not working. What should be a good experience for the onboarding form?
3. [ ] On clicking +20 or +500 For hydration, I am seeing that the page is reloading. But it is a simple addition, and just the circle should keep filling. Page should not be reloaded.
4. [ ] Clicking on delete on one of the items deleted the entire plate entries. And nothing is showing up in today's plates on the main page. 
5. [ ] On the card showing protein carb etc macros bars, the legend on the right is not useful As the bar's themselves have titles about them 
6. [ ] On the macros bars card, show how many consumed instead of remaining.
7. [ ] User should be able to update the targets during onboarding - and recalcute the cals, macros, weeks to reach target etc.. flush this out as a good experience.
8. [ ] As I enter each meal, I want a sum of the cals macros in that meal.. rn I am adding it in my brain, not present on the scree.
9. [x] On uploading an image, it starts analysing immediately, sometimes I want to add some text details and as a user I do not know i need to only write that first.
10. [x] The curries are showing as katori for measurement. it is not a standard size and more errorprone. I want all estimates we show to be in standard cups sizes only like cup, tbsp, tsp, gm, ml, pieces as relevant.
11. [x] Also seeing "glass" as a measurement - it can be any size, ml glass. every household is not the same. Make sure it is also always in ml instead.
12. [x] I am asked a qestion like it is minimal oil or medium or restaurant style, i dont know if the numbers are changed based on my selection.
13. [x] For each meal, I want to see the sub total of macros and calories to get an idea if it is a balanced meal.
14. [x] The golden yellow color bars and day highlights are too much for the eyes. make it better.
15. [x] Not able to mark item as favourite in the log.
16. [x] When adding items from recents and faves, i shoulf be able to select multiple items at once and add them to the meal.
17. [x] On adding item from favorites, the portion is wrong. is 2 roties when i favourited it from lunch, but when i selected from faves to dinner it shows the cals macros of the 2 rotis, but the quantity as 1. and another curry added with same flow shows as peice instead of as a cup measure.
18. [x] Sometimes the dish is identified incorrectly, when I correct the name the numbers should be updated accordingly.
19. [x] Show the breakdown of the dish and hence calculate the calories.
20. [x] After this implementation, I am seeing oil related question for every dish even when not relevant. example boiled egg white does not need any refinement related question. ragi java is a boiled dish has no oil even by the ai's accounting, so oil question in not relevant.
21. [x] I dont like the "eye" icon beside the description.. i guess it could mean "i saw" <<whatever is the item>>, but not aesthetic.
22. [x] For every refinement call, all the items are sent and received back.. it might lead to changing things that dont need to be? how are we actually handling the response from refine call? are all the items in the UI refreshed with that response?
23. [x] On the home page dashboard I dont want to see the descriptive line, and even in the history log page. it can be part of edit item box when opened, bt not on the front.. too cluttered.

to do:
---

24. [ ] Design choice: get possible close alternatives also as a part of the gemini response, with the confidence? And show them as the alternatives that user can click on to replace the primary one shown.
25. [ ] Give the meal-analysis calls their own longer axios timeout. `frontend/src/api/client.ts` now sets a 30s default timeout on the whole instance, which is right for the fast CRUD routes. But `POST /meals/analyze` (`MealLog.tsx:91`) and `/meals/analyze/refine` (`MealLog.tsx:160`, `MealLog.tsx:231`, `api/mealRefine.ts:52`) upload a base64 photo, then wait on Gemini, then possibly on a cold Railway container. That chain could cross 30s and get aborted mid-flight, so the user sees a failure for a request that would have succeeded. Fix is to pass `{ timeout: 90000 }` as the per-request config on just those calls and leave the 30s default alone. Watch the console during the first real deployed photo logs to see whether it actually trips.
26. [ ] Password sign-up (`Login.tsx`) only checks length (>= 6 chars, matching Supabase's default minimum). Nothing stops something like "111111". Worth adding a basic strength check (e.g. reject common/sequential passwords) before this goes live.
