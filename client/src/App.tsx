import {useEffect, useState} from "react"
import type {FormEvent, ReactNode} from "react"
import {BookOpen, LogOut, Plus} from "lucide-react"
import {Alert, AlertDescription} from "@/components/ui/alert"
import {Badge} from "@/components/ui/badge"
import {Button} from "@/components/ui/button"
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select"
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table"
import {Textarea} from "@/components/ui/textarea"

type Post = {
  id: number;
  title: string;
  slug: string;
  body_markdown: string;
  status: "draft" | "published";
  published_at: string | null
}
type Theme = { name: string; label: string; description: string }
type Session = { user: { email: string } | null; csrfToken: string | null; themes: Theme[]; activeTheme: string }

async function api<T>(path: string, options: RequestInit = {}, csrf?: string | null): Promise<T> {
  const response = await fetch(`/api${path}`, {
    credentials: "same-origin",
    headers: {"Content-Type": "application/json", ...(csrf ? {"X-CSRF-Token": csrf} : {}), ...options.headers}, ...options
  });
  if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error ?? "Request failed.");
  return response.status === 204 ? undefined as T : response.json()
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState({title: "", slug: "", bodyMarkdown: ""})
  const refresh = async () => {
    try {
      const [nextSession, nextPosts] = await Promise.all([api<Session>("/session"), api<Post[]>("/posts")]);
      setSession(nextSession);
      setPosts(nextPosts)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load Zlog.")
    }
  }
  useEffect(() => {
    void refresh()
  }, [])
  if (!session) return <main className="grid min-h-svh place-items-center"><p className="text-muted-foreground">Loading
    Zlog...</p></main>
  const createPost = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await api("/admin/posts", {method: "POST", body: JSON.stringify(draft)}, session.csrfToken);
      setDraft({title: "", slug: "", bodyMarkdown: ""});
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save post.")
    }
  }
  const changeTheme = async (theme: string) => {
    try {
      await api("/admin/theme", {method: "POST", body: JSON.stringify({theme})}, session.csrfToken);
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update theme.")
    }
  }
  const signOut = async () => {
    await api("/logout", {method: "POST"}, session.csrfToken);
    await refresh()
  }
  return <main className="mx-auto min-h-svh max-w-5xl px-5 py-8 sm:px-8">
    <header className="mb-10 flex items-center justify-between border-b pb-5">
      <div className="flex items-center gap-3"><BookOpen className="size-5"/><span
        className="text-lg font-semibold">Zlog</span></div>
      {session.user && <Button variant="ghost" size="sm" onClick={() => void signOut()}><LogOut/>Sign out</Button>}
    </header>
    {error && <Alert variant="destructive"
                     className="mb-6"><AlertDescription>{error}</AlertDescription></Alert>}{!session.user ?
    <Login onSignedIn={refresh} onError={setError}/> : <section className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div>
        <div className="mb-5 flex items-center justify-between">
          <div><h1 className="text-2xl font-semibold">Posts</h1><p
            className="text-sm text-muted-foreground">{session.user.email}</p></div>
          <Badge variant="secondary">{posts.length} published</Badge></div>
        <PostList posts={posts}/></div>
      <aside className="space-y-5"><Card><CardHeader><CardTitle
        className="text-base">Appearance</CardTitle></CardHeader><CardContent><Select value={session.activeTheme}
                                                                                      onValueChange={changeTheme}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{session.themes.map(theme =>
        <SelectItem key={theme.name}
                    value={theme.name}>{theme.label}</SelectItem>)}</SelectContent></Select></CardContent></Card><Card><CardHeader><CardTitle
        className="flex items-center gap-2 text-base"><Plus className="size-4"/>New
        draft</CardTitle></CardHeader><CardContent>
        <form className="grid gap-4" onSubmit={createPost}>
          <Field label="Title">
            <Input required value={draft.title}
                   onChange={event => setDraft({
                     ...draft,
                     title: event.target.value
                   })}/>
          </Field>
          <Field label="Slug">
            <Input
              required pattern="[a-z0-9]+(-[a-z0-9]+)*" value={draft.slug}
              onChange={event => setDraft({...draft, slug: event.target.value})}/></Field><Field label="Body"><Textarea
          rows={8} value={draft.bodyMarkdown}
          onChange={event => setDraft({...draft, bodyMarkdown: event.target.value})}/></Field><Button type="submit">Save
          draft</Button></form>
      </CardContent></Card></aside>
    </section>}</main>
}

function Login({onSignedIn, onError}: { onSignedIn: () => Promise<void>; onError: (message: string) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await api("/login", {method: "POST", body: JSON.stringify({email, password})});
      await onSignedIn()
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Could not sign in.")
    }
  };
  return <Card className="mx-auto mt-16 max-w-sm"><CardHeader><CardTitle>Sign in</CardTitle></CardHeader><CardContent>
    <form className="grid gap-4" onSubmit={submit}><Field label="Email"><Input type="email" required value={email}
                                                                               onChange={event => setEmail(event.target.value)}/></Field><Field
      label="Password"><Input type="password" required value={password}
                              onChange={event => setPassword(event.target.value)}/></Field><Button type="submit">Sign
      in</Button></form>
  </CardContent></Card>
}

function Field({label, children}: { label: string; children: ReactNode }) {
  return <div className="grid gap-2"><Label>{label}</Label>{children}</div>
}

function PostList({posts}: { posts: Post[] }) {
  return <Card><Table><TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Published</TableHead></TableRow></TableHeader><TableBody>{posts.length ? posts.map(post =>
      <TableRow key={post.id}><TableCell
        className="font-medium">{post.title}</TableCell><TableCell>{post.published_at ? new Date(post.published_at).toLocaleDateString() : "Draft"}</TableCell></TableRow>) :
    <TableRow><TableCell colSpan={2} className="text-muted-foreground">No published posts
      yet.</TableCell></TableRow>}</TableBody></Table></Card>
}
