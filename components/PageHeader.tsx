{open ? (
  <div
    role="menu"
    aria-label="Site menu"
    style={{
      marginTop: 10,
      minWidth: 220,
      background: "white",
      borderRadius: 12,
      border: "1px solid rgba(0,0,0,0.14)",
      boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
      overflow: "hidden",
    }}
  >
    <MenuItem href="/" onPick={() => setOpen(false)}>
      Home
    </MenuItem>

    <MenuItem href="/events" onPick={() => setOpen(false)}>
      Events
    </MenuItem>

    <MenuItem href="/login" onPick={() => setOpen(false)}>
      Login
    </MenuItem>

    <MenuItem href="/email-your-congressperson" onPick={() => setOpen(false)}>
      Email Your Congressperson
    </MenuItem>

    <MenuItem href="/create" onPick={() => setOpen(false)}>
      Create Event
    </MenuItem>

    <MenuItem href="/know-your-rights" onPick={() => setOpen(false)}>
      Know Your Rights
    </MenuItem>
  </div>
) : null}