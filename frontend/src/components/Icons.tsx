export function IconPlus() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <path d="M7.5 1.5V13.5M1.5 7.5H13.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function IconTrash() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path
        d="M2.5 3.75H11.5M5.25 3.75V2.5C5.25 2.086 5.586 1.75 6 1.75H8C8.414 1.75 8.75 2.086 8.75 2.5V3.75M6 6.5V10M8 6.5V10M3.25 3.75L3.75 11.25C3.78 11.66 4.12 12 4.53 12H9.47C9.88 12 10.22 11.66 10.25 11.25L10.75 3.75"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconBook({ active }: { active?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
      <path
        d="M10 4.5C8.7 3.6 6.8 3.2 4.5 3.2C3.9 3.2 3.4 3.7 3.4 4.3V14.3C3.4 14.9 3.9 15.4 4.5 15.4C6.8 15.4 8.7 15.8 10 16.7C11.3 15.8 13.2 15.4 15.5 15.4C16.1 15.4 16.6 14.9 16.6 14.3V4.3C16.6 3.7 16.1 3.2 15.5 3.2C13.2 3.2 11.3 3.6 10 4.5Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
        fill={active ? "currentColor" : "none"}
        fillOpacity={active ? 0.12 : 0}
      />
      <path d="M10 4.5V16.7" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

export function IconSend() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M14 2L7 9M14 2L9.5 14L7 9M14 2L2 6.5L7 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconClose() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2 2L12 12M12 2L2 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function IconScroll() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path
        d="M6 4H17C18.1 4 19 4.9 19 6V18C19 19.1 18.1 20 17 20H8C6.9 20 6 19.1 6 18V4Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path d="M9 8H15M9 11.5H15M9 15H13" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}

export function IconPaperclip() {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" fill="none">
      <path
        d="M16.5 9.4L10.1 15.8C8.5 17.4 5.9 17.4 4.3 15.8C2.7 14.2 2.7 11.6 4.3 10L10.9 3.4C11.9 2.4 13.5 2.4 14.5 3.4C15.5 4.4 15.5 6 14.5 7L8.2 13.3C7.7 13.8 6.9 13.8 6.4 13.3C5.9 12.8 5.9 12 6.4 11.5L12 5.9"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconFile() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path
        d="M3.5 1.75H8L10.5 4.25V11.5C10.5 11.91 10.16 12.25 9.75 12.25H3.5C3.09 12.25 2.75 11.91 2.75 11.5V2.5C2.75 2.09 3.09 1.75 3.5 1.75Z"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      <path d="M8 1.75V4.25H10.5" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
    </svg>
  );
}
