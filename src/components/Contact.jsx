import { useState } from "react";
import { styles } from "../styles";
import SectionHead from "./SectionHead";
import SunlitFloor from "./SunlitFloor";

// The last page of the journal: a note to send, on the sunlit floor where
// raly likes to rest.
const Field = ({ label, children }) => (
  <label className="flex flex-col gap-2">
    <span className="font-mono text-[10.5px] tracking-[0.16em] uppercase text-muted">{label}</span>
    {children}
  </label>
);

const EMAIL = "raphaelbahadurkhan@gmail.com";
// Web3Forms relays the note to EMAIL. The access key only identifies the
// inbox; it is meant to live in client-side code.
const ENDPOINT = "https://api.web3forms.com/submit";
const ACCESS_KEY = "8a7ec705-c812-4ca2-ac4f-1b5fc34afee9";

const inputClass =
  "bg-transparent border-0 border-b border-hair focus:border-ink-text outline-none py-2.5 text-[16px] text-ink-text placeholder:text-muted/70 transition-colors";

const Contact = () => {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [status, setStatus] = useState("idle");
  const change = event => setForm({ ...form, [event.target.name]: event.target.value });

  const submit = async event => {
    event.preventDefault();
    setStatus("sending");
    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          access_key: ACCESS_KEY,
          subject: `raphaelkhalid.com: a note from ${form.name}`,
          from_name: "raphaelkhalid.com",
          name: form.name,
          email: form.email,
          message: form.message,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.success !== true) throw new Error(result.message || `HTTP ${response.status}`);
      setStatus("sent");
      setForm({ name: "", email: "", message: "" });
    } catch (error) {
      // Keep what they wrote, so the direct-email fallback can carry it.
      console.error(error);
      setStatus("failed");
    }
  };

  return (
    <section className="relative w-full">
      <span className="hash-span" id="contact">&nbsp;</span>
      <div className={`${styles.paddingX} max-w-[1440px] mx-auto pt-6`}>
        <SectionHead index="05" label="contact" title="Say hello." />
        <form onSubmit={submit} className="grid md:grid-cols-2 gap-x-12 gap-y-8 max-w-[980px]">
          <Field label="Your name">
            <input className={inputClass} type="text" name="name" required value={form.name} onChange={change} placeholder="What should I call you?" />
          </Field>
          <Field label="Your email">
            <input className={inputClass} type="email" name="email" required value={form.email} onChange={change} placeholder="Where can I reply?" />
          </Field>
          <div className="md:col-span-2">
            <Field label="Message">
              <textarea className={`${inputClass} resize-y min-h-[120px]`} name="message" required rows={4} value={form.message} onChange={change} placeholder="An experiment, a collaboration, a question…" />
            </Field>
          </div>
          <div className="md:col-span-2 flex items-center gap-6 flex-wrap">
            <button type="submit" disabled={status === "sending"} className="font-mono text-[11px] tracking-[0.16em] uppercase px-6 py-3 rounded-full bg-ink-text text-paper hover:bg-coral transition-colors disabled:opacity-60">
              {status === "sending" ? "sending…" : "send note"}
            </button>
            <p className="font-mono text-[11px] tracking-[0.12em] uppercase text-muted" role="status">
              {status === "sent" && "Thank you, I'll write back soon."}
              {status === "failed" && (
                <>
                  That didn&apos;t go through.{" "}
                  <a
                    className="text-ink-text underline underline-offset-4 hover:text-coral normal-case tracking-normal"
                    href={`mailto:${EMAIL}?subject=${encodeURIComponent("Hello from raphaelkhalid.com")}&body=${encodeURIComponent(form.message)}`}
                  >
                    Email {EMAIL}
                  </a>
                </>
              )}
            </p>
            <a href={`mailto:${EMAIL}`} className="ml-auto font-mono text-[11px] tracking-[0.16em] uppercase text-muted hover:text-coral transition-colors">
              email ↗
            </a>
            <a href="https://github.com/RaphaelKhalid" target="_blank" rel="noreferrer" className=" font-mono text-[11px] tracking-[0.16em] uppercase text-muted hover:text-coral transition-colors">
              github ↗
            </a>
          </div>
        </form>
      </div>
      <div id="sunlit-floor" className="sunlit-floor mt-16 h-[46vh] min-h-[300px]">
        <SunlitFloor />
        <div className={`${styles.paddingX} max-w-[1440px] mx-auto h-full flex items-end`}>
          <p className="relative w-full flex justify-between border-t border-hair py-5 font-mono text-[10.5px] tracking-[0.16em] uppercase text-muted">
            <span>raphaelkhalid.com</span>
            <span>© {new Date().getFullYear()} raphael khalid</span>
          </p>
        </div>
      </div>
    </section>
  );
};

export default Contact;
