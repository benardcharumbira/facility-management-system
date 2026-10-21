# Facilities booking: information we need from Midvaal

The facilities browse screen is built and currently shows the twelve venues named in section 7 of
the Business Requirements Document (v2.0). Only the venue names come from that document. Every
other detail on screen is a placeholder we made up so the screen can be demonstrated, and is
labelled as sample data. The answers below let us replace the placeholders with the real thing.

**The twelve venues:** City Hall, Mitchell Wing, City Hall Committee Room, Loch Wing, Council
Chambers, Rothdene Hall, Vaal Marina Hall, Vaal Marina Board Room, Activity Room, Bantu Bonke Hall,
Sicelo Hall, Lakeside Hall.

## Questions

1. **Facilities register.** Can you send the complete register of bookable halls and rooms? In
   particular, are the twelve venues above the full list, or are there others?

2. **Which venues sit inside others.** We have assumed Mitchell Wing, Loch Wing and the City Hall
   Committee Room are part of City Hall, and that Vaal Marina Board Room is part of Vaal Marina
   Hall. Is that right? If so, should booking City Hall block Mitchell Wing, Loch Wing and the
   committee room, and should booking a wing block City Hall? Please also confirm that Council
   Chambers and the Activity Room are not part of another venue.

3. **Seating capacity.** What is the capacity of each venue? Does it change with the seating
   arrangement (the booking form asks for one), and if so, what is the capacity for each
   arrangement?

4. **Locations.** In which locality or suburb are Bantu Bonke Hall and the Activity Room? Does the
   Activity Room sit within another building? Please also confirm our assumptions: City Hall, its
   wings, the committee room and Council Chambers in Meyerton; Rothdene Hall in Rothdene; Vaal
   Marina Hall and Board Room in Vaal Marina; Sicelo Hall in Sicelo; Lakeside Hall in Lakeside.

5. **Resources at each venue.** Which of these are actually available at each venue: tables,
   chairs, stage, podium, sound system and a kitchen, and in what quantities? For venues with a
   kitchen, please send the itemised equipment list (urns, crockery, cutlery and so on) with
   quantities; the venue page shows it as a collapsible list.

6. **Council Chambers.** Can the public book it, or is it for internal use only?

7. **Photographs.** Please send photographs of each venue, and tell us who owns them and whether we
   may use them on the booking site. We will not use photographs from elsewhere. Until then each
   venue shows a neutral placeholder.

8. **Recreational facilities.** Which sports fields, courts, pools or open spaces, if any, should
   be bookable through this system? None are described in the requirements document, so none are
   shown yet.

9. **Opening hours.** On which days and between which times can each venue be booked?

10. **Responsible department.** Which municipal department manages each venue? The page shows a
    "Managed by" line.

11. **Booking conditions.** Is there anything an applicant should know before requesting a
    booking (deposits, minimum notice, set-up and clean-up time, alcohol or noise rules)? We show
    these as a short notice on the venue page.

12. **Booking rules.** How much notice is required before a booking, how far ahead can people
    book, and what is the shortest booking? We have assumed 48 hours, 90 days and 1 hour.

13. **Set-up and clear-down time.** Does the venue need time before and after an event, and how
    long, per venue? Do pending requests hold the time, and for how long?

14. **Closures.** Which public holidays close the venues, and how are maintenance closures
    recorded? We have assumed all venues close on South African public holidays.

15. **Booking form lists.** Please confirm the list of meeting or event types and the list of
    seating arrangements the paper form offers, the wording of the terms and conditions, whether
    supporting documents are required or optional, and the file types and sizes you will accept.
    Also, how long a pending request may hold a time, and the expected turnaround for a decision.

16. **Cancelling and changing a booking.** How close to the event can an approved booking still be
    cancelled, or moved? We assumed 72 hours. Should the reason for a cancellation be required or
    optional? We made it optional. Who decides a change of date request, and can an applicant
    withdraw one?

17. **What the applicant can see about a decision.** Should the booking history show the name of
    the staff member who approved or rejected it, or only that the municipality did? And how long
    does a pending request hold the time before it is released? We assumed 72 hours.

18. **When one request is approved, what happens to the ones it displaces?** We assumed they stay
    in the queue, can no longer be approved, and must each be rejected by a person with a reason,
    because the reason is the only explanation the applicant receives. The alternative is to
    reject them automatically with a standard message. Which do you want?

19. **Who approves which venues?** We assumed an approver is designated against a list of venues,
    and that a building and its rooms are designated together. If a request for City Hall competes
    with one for a wing the approver is not designated against, they see it named but cannot open
    it. Is that right, and who decides when two approvers' venues overlap?

20. **Turnaround.** We assumed a target of 5 working days (120 hours) from submission, flagged as
    approaching within 24 hours of it, and that a hold ending within 24 hours deserves a flag. Are
    those the right figures, and should a change of date have its own target?

21. **What an approver may write.** Should an internal note on an approval be kept for audit and
    shown to later approvers? Should the applicant be told which staff member decided? (See Q17.)
    We assumed the note is internal and permanent, and that the reason is sent exactly as written.

22. **Who may edit which facilities?** We assumed every facility administrator and system
    administrator can change every facility. Should a facility administrator be limited to the
    facilities they are responsible for?

23. **Set-up and clear-down.** We assumed a buffer per facility, the same for every booking, held
    both before and after, and that it blocks related spaces too. Does it vary by event type or by
    how many people are expected? None of the current facilities has one until you set it.

24. **When a change reaches existing bookings.** Today the screen names the bookings and leaves it
    there. Should it also flag them for review, put them in someone's queue, or tell the applicant?
    And when a facility is archived or made unavailable, what should happen to its pending requests?
    They stay in the approvers' queue for now.

25. **Facilities without an approver.** We prevent activating one and prevent removing the last
    approver of an active one. Three facilities in the fixture have none. Who should approve for the
    Activity Room, Bantu Bonke Hall and the Council Chambers? Should a facility with none ever be
    allowed to take bookings?

26. **Closure wording.** The reason for a closure is shown to the public as written. Should there be
    standard wording, or a check before it is published?

27. **"Dining forks" and "Forks".** The requirements document lists both as separate kitchen
    items. Is that a real distinction the municipality makes (a place setting against serving forks,
    perhaps), or a duplication on the paper form? We have kept both, as the source does, and not
    merged them. If it is a duplication, which should stay?

28. **Counted or not.** We assumed a stage, a podium and a sound system are present or absent, and
    everything else is counted. Is that right? Does any venue have two podiums, or need the number
    of stages? And when something stops being counted, we leave a facility that held any marked
    available and discard the number; when it starts being counted, every facility starts at none.
    Is that what you want?

29. **Categories.** We have fixed two, venue and kitchen, to match the booking form. Do you need
    others (audio visual equipment, for instance), and should they appear on the form?

30. **A booking short of what it asked for.** When a venue is left holding fewer chairs than an
    approved booking requested, or withdraws its stage, the screen names the booking and does
    nothing else. What should happen next: should the applicant be told, should it be flagged for an
    approver, or is it handled by hand? (See also Q24.)

31. **What an event type should do.** Today it affects nothing beyond reporting: not who approves a
    request and not whether a venue can be booked. Should it ever (a funeral or a wedding routed to a
    different approver, a venue closed to some kinds of event)? And what are the real lists of event
    types and seating arrangements? Ours are invented.

32. **One role or several.** We treat a person as holding exactly one of applicant, internal user,
    facility administrator or system administrator. Does anyone need two (an approver who is also an
    applicant for their own events)? And what, precisely, should an internal user be able to do that
    an applicant cannot? We have said nothing, only that they are municipal staff who book.

33. **When someone stops being an approver.** Leaving the facility administrator role, or being
    deactivated, removes their facilities, and reactivating does not give them back. The alternative
    is to keep them and ignore them while the account is off. Which do you want? And when that leaves
    a facility with nobody, should it become unavailable by itself, or only be reported, as now?

34. **Who may grant what.** Any system administrator can make any other a system administrator, and
    can deactivate one (but never the last). Should granting that role need two people, or a reason
    written down?

35. **The words of the terms.** We store them as plain paragraphs. Will the municipality supply them
    as a document, with headings and numbered clauses, or as a PDF? Rich text, or a link to a
    document, changes how an applicant accepts "the version they read". And may a published version
    ever be withdrawn without a replacement?

36. **The audit trail.** We record bookings, approvals and administration of users and reference
    data, and not yet facility or resource changes. Which should it cover? How long should entries
    be kept, who besides system administrators (an auditor, say) may read it, and is a written
    reason needed to export it? An export is recorded with who, the filters and the row count.

## What we assumed, for reference

| Detail                                          | Assumption                                  |
| ----------------------------------------------- | ------------------------------------------- |
| Venue types (hall, hall wing, board room, etc.) | Taken from the venue names                  |
| Descriptions, short codes, availability status  | Placeholders; all venues shown as available |
| Capacities                                      | Plausible figures by venue type, not real   |
| Resources per venue                             | Plausible by venue type, not real           |
