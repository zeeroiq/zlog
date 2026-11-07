import {useEffect, useState} from "react"
import type {FormEvent, ReactNode} from "react"
import {
  Activity,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Eye,
  Globe,
  Laptop,
  LogOut,
  Mail,
  MapPin,
  Plus,
  RotateCw,
  Smartphone,
  Tablet,
  Users,
} from "lucide-react"
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
  published_at: string | null;
}
type Theme = { name: string; label: string; description: string }
type Session = { user: { email: string } | null; csrfToken: string | null; themes: Theme[]; activeTheme: string }
type Subscriber = { id: number; email: string; subscribed_at: string }

type Visitor = {
  visitor_id: string;
  ip_address: string;
  country: string | null;
  city: string | null;
  location: string;
  device_type: string;
  os: string;
  browser: string;
  total_visits: number;
  is_returning: number;
  unique_pages: number;
  first_seen: string;
  last_seen: string;
}

type RecentActivity = {
  id: number;
  path: string;
  visitor_id: string;
  ip_address: string;
  country: string | null;
  city: string | null;
  location: string;
  device_type: string;
  os: string;
  browser: string;
  is_returning: number;
  is_page_repeat: number;
  visit_number: number;
  viewed_at: string;
}

type PostViewStat = {
  slug: string;
  views: number;
  unique_visitors: number;
  repeat_views?: number;
  returning_visitors?: number;
}

type CountryStat = {
  country: string;
  views: number;
  formatted: string;
}

type Analytics = {
  totalViews: number;
  uniqueVisitors: number;
  returningVisitors: number;
  repeatViews: number;
  devices: { desktop: number; mobile: number; tablet: number; bot?: number };
  countries?: CountryStat[];
  topPaths: { path: string; views: number; unique_visitors: number }[];
  postViews: PostViewStat[];
  totalVisitors?: number;
  totalActivity?: number;
  visitors: Visitor[];
  recentActivity: RecentActivity[];
}

type SubscribersData = { count: number; subscribers: Subscriber[] }

async function api<T>(path: string, options: RequestInit = {}, csrf?: string | null): Promise<T> {
  const response = await fetch(`/api${path}`, {
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(csrf ? {"X-CSRF-Token": csrf} : {}),
      ...options.headers,
    },
    ...options,
  });
  if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error ?? "Request failed.");
  return response.status === 204 ? undefined as T : response.json();
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [subscribersData, setSubscribersData] = useState<SubscribersData | null>(null);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState({title: "", slug: "", bodyMarkdown: ""});

  const refresh = async () => {
    try {
      const [nextSession, nextPosts] = await Promise.all([
        api<Session>("/session"),
        api<Post[]>("/posts"),
      ]);
      setSession(nextSession);
      setPosts(nextPosts);
      if (nextSession.user) {
        const [nextAnalytics, nextSubs] = await Promise.all([
          api<Analytics>("/admin/analytics"),
          api<SubscribersData>("/admin/subscribers"),
        ]);
        setAnalytics(nextAnalytics);
        setSubscribersData(nextSubs);
      } else {
        setAnalytics(null);
        setSubscribersData(null);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load Zlog.");
    }
  };

  useEffect(() => { void refresh(); }, []);

  if (!session) {
    return (
      <main className="grid min-h-svh place-items-center">
        <p className="text-muted-foreground">Loading Zlog...</p>
      </main>
    );
  }

  const createPost = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await api("/admin/posts", {method: "POST", body: JSON.stringify(draft)}, session.csrfToken);
      setDraft({title: "", slug: "", bodyMarkdown: ""});
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save post.");
    }
  };

  const changeTheme = async (theme: string) => {
    try {
      await api("/admin/theme", {method: "POST", body: JSON.stringify({theme})}, session.csrfToken);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update theme.");
    }
  };

  const signOut = async () => {
    await api("/logout", {method: "POST"}, session.csrfToken);
    await refresh();
  };

  const removeSubscriber = async (id: number) => {
    try {
      await api(`/admin/subscribers/${id}`, {method: "DELETE"}, session.csrfToken);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not remove subscriber.");
    }
  };

  const removeVisitor = async (visitorId: string) => {
    if (!confirm("Delete all records for this visitor?")) return;
    try {
      await api(`/admin/analytics/visitors/${encodeURIComponent(visitorId)}`, {method: "DELETE"}, session.csrfToken);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete visitor records.");
    }
  };

  const removeActivity = async (id: number) => {
    try {
      await api(`/admin/analytics/views/${id}`, {method: "DELETE"}, session.csrfToken);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete activity record.");
    }
  };

  const returnRate = analytics && analytics.uniqueVisitors > 0
    ? Math.round((analytics.returningVisitors / analytics.uniqueVisitors) * 100)
    : 0;

  return (
    <main className="mx-auto min-h-svh max-w-5xl px-5 py-8 sm:px-8">
      <header className="mb-8 flex items-center justify-between border-b pb-5">
        <div className="flex items-center gap-3">
          <BookOpen className="size-5"/>
          <span className="text-lg font-semibold">Zlog</span>
        </div>
        {session.user && (
          <Button variant="ghost" size="sm" onClick={() => void signOut()}>
            <LogOut className="size-4 mr-1.5"/> Sign out
          </Button>
        )}
      </header>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!session.user ? (
        <Login onSignedIn={refresh} onError={setError}/>
      ) : (
        <div className="space-y-10">
          {/* Stats overview */}
          {analytics && (
            <div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <StatCard icon={<Eye className="size-4"/>} label="Total Views" value={analytics.totalViews}/>
                <StatCard icon={<Users className="size-4"/>} label="Unique Visitors" value={analytics.uniqueVisitors}/>
                <StatCard
                  icon={<RotateCw className="size-4"/>}
                  label="Returning Visitors"
                  value={analytics.returningVisitors}
                  subtitle={`${returnRate}% repeat rate`}
                />
                <StatCard icon={<Activity className="size-4"/>} label="Repeat Views" value={analytics.repeatViews ?? 0}/>
                <StatCard icon={<Mail className="size-4"/>} label="Subscribers" value={subscribersData?.count ?? 0}/>
              </div>

              {/* Devices and Location pills */}
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Devices:</span>
                <span className="rounded-md bg-muted px-2 py-0.5 inline-flex items-center gap-1">
                  <Laptop className="size-3"/> Desktop: <strong>{analytics.devices?.desktop ?? 0}</strong>
                </span>
                <span className="rounded-md bg-muted px-2 py-0.5 inline-flex items-center gap-1">
                  <Smartphone className="size-3"/> Mobile: <strong>{analytics.devices?.mobile ?? 0}</strong>
                </span>
                <span className="rounded-md bg-muted px-2 py-0.5 inline-flex items-center gap-1">
                  <Tablet className="size-3"/> Tablet: <strong>{analytics.devices?.tablet ?? 0}</strong>
                </span>

                {analytics.countries && analytics.countries.length > 0 && (
                  <>
                    <span className="ml-2 font-medium text-foreground inline-flex items-center gap-1">
                      <MapPin className="size-3"/> Locations:
                    </span>
                    {analytics.countries.map(c => (
                      <span key={c.country} className="rounded-md bg-muted px-2 py-0.5">
                        {c.formatted} <strong>{c.views}</strong>
                      </span>
                    ))}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Posts + sidebar */}
          <section className="grid gap-8 lg:grid-cols-[1fr_320px]">
            <div>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-semibold">Posts</h1>
                  <p className="text-sm text-muted-foreground">{session.user.email}</p>
                </div>
                <Badge variant="secondary">{posts.length} published</Badge>
              </div>
              <PostList posts={posts} postViews={analytics?.postViews ?? []}/>
            </div>

            <aside className="space-y-5">
              <Card>
                <CardHeader><CardTitle className="text-base">Appearance</CardTitle></CardHeader>
                <CardContent>
                  <Select value={session.activeTheme} onValueChange={changeTheme}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>
                      {session.themes.map(theme => (
                        <SelectItem key={theme.name} value={theme.name}>{theme.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Plus className="size-4"/> New draft
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form className="grid gap-4" onSubmit={createPost}>
                    <Field label="Title">
                      <Input required value={draft.title}
                             onChange={e => setDraft({...draft, title: e.target.value})}/>
                    </Field>
                    <Field label="Slug">
                      <Input required pattern="[a-z0-9]+(-[a-z0-9]+)*" value={draft.slug}
                             onChange={e => setDraft({...draft, slug: e.target.value})}/>
                    </Field>
                    <Field label="Body">
                      <Textarea rows={8} value={draft.bodyMarkdown}
                                onChange={e => setDraft({...draft, bodyMarkdown: e.target.value})}/>
                    </Field>
                    <Button type="submit">Save draft</Button>
                  </form>
                </CardContent>
              </Card>
            </aside>
          </section>

          {/* Identified Visitors & Nodes (with location, shadow scroll & pagination) */}
          {analytics && analytics.visitors && (
            <section>
              <div className="mb-3">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <Globe className="size-5"/> Identified Visitors &amp; Nodes
                </h2>
                <p className="text-xs text-muted-foreground">
                  Identifies nodes, country/city locations, repeat visits, and system details with pagination and shadow scrolling.
                </p>
              </div>
              <PaginatedVisitorList visitors={analytics.visitors} onRemove={removeVisitor}/>
            </section>
          )}

          {/* Live Recent Activity Stream (with location, shadow scroll & pagination) */}
          {analytics && analytics.recentActivity && (
            <section>
              <div className="mb-3">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <Activity className="size-5"/> Live Activity Stream
                </h2>
                <p className="text-xs text-muted-foreground">
                  Real-time page views with location and repeat visit indicators.
                </p>
              </div>
              <PaginatedActivityList activity={analytics.recentActivity} onRemove={removeActivity}/>
            </section>
          )}

          {/* Subscribers table */}
          {subscribersData && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-xl font-semibold">
                <Mail className="size-5"/> Newsletter subscribers
                <span className="text-sm font-normal text-muted-foreground">({subscribersData.count})</span>
              </h2>
              <SubscriberList subscribers={subscribersData.subscribers} onRemove={removeSubscriber}/>
            </section>
          )}
        </div>
      )}
    </main>
  );
}

function StatCard({icon, label, value, subtitle}: { icon: ReactNode; label: string; value: number; subtitle?: string }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
          {icon}
          <span className="text-[11px] font-medium uppercase tracking-wider">{label}</span>
        </div>
        <p className="text-2xl font-bold">{value.toLocaleString()}</p>
        {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

function Login({onSignedIn, onError}: { onSignedIn: () => Promise<void>; onError: (message: string) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await api("/login", {method: "POST", body: JSON.stringify({email, password})});
      await onSignedIn();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Could not sign in.");
    }
  };
  return (
    <Card className="mx-auto mt-16 max-w-sm">
      <CardHeader><CardTitle>Sign in</CardTitle></CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={submit}>
          <Field label="Email">
            <Input type="email" required value={email} onChange={e => setEmail(e.target.value)}/>
          </Field>
          <Field label="Password">
            <Input type="password" required value={password} onChange={e => setPassword(e.target.value)}/>
          </Field>
          <Button type="submit">Sign in</Button>
        </form>
      </CardContent>
    </Card>
  );
}

function Field({label, children}: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function PostList({posts, postViews}: { posts: Post[]; postViews: PostViewStat[] }) {
  const viewMap = Object.fromEntries(postViews.map(pv => [pv.slug, pv]));
  return (
    <Card>
      <div className="shadow-scroll-container">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Views</TableHead>
              <TableHead className="text-right">Unique</TableHead>
              <TableHead className="text-right">Repeat</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {posts.length ? posts.map(post => {
              const stat = viewMap[post.slug];
              return (
                <TableRow key={post.id}>
                  <TableCell className="font-medium">{post.title}</TableCell>
                  <TableCell>
                    <Badge variant={post.status === "published" ? "default" : "outline"} className="text-xs">
                      {post.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{stat?.views ?? 0}</TableCell>
                  <TableCell className="text-right tabular-nums">{stat?.unique_visitors ?? 0}</TableCell>
                  <TableCell className="text-right tabular-nums">{stat?.repeat_views ?? 0}</TableCell>
                </TableRow>
              );
            }) : (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground">No posts yet.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

function PaginatedVisitorList({visitors, onRemove}: { visitors: Visitor[]; onRemove: (visitorId: string) => Promise<void> }) {
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(visitors.length / pageSize));
  const displayed = visitors.slice((page - 1) * pageSize, page * pageSize);

  return (
    <Card>
      <div className="shadow-scroll-container">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Node / IP</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>System (OS &amp; Browser)</TableHead>
              <TableHead>Device</TableHead>
              <TableHead>Repeat Status</TableHead>
              <TableHead className="text-right">Pages</TableHead>
              <TableHead className="text-right">Last Seen</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayed.length ? displayed.map((v, i) => (
              <TableRow key={v.visitor_id || i}>
                <TableCell className="font-mono text-xs">{v.ip_address}</TableCell>
                <TableCell className="text-xs whitespace-nowrap">{v.location || "—"}</TableCell>
                <TableCell className="text-xs">{v.os} · {v.browser}</TableCell>
                <TableCell className="capitalize text-xs text-muted-foreground">{v.device_type}</TableCell>
                <TableCell>
                  {v.is_returning ? (
                    <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs">
                      Returning ({v.total_visits}x)
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">
                      New (1x)
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums text-xs">{v.unique_pages}</TableCell>
                <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">
                  {v.last_seen ? new Date(v.last_seen).toLocaleString(undefined, {dateStyle: "short", timeStyle: "short"}) : "—"}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                    onClick={() => void onRemove(v.visitor_id)}
                  >
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={8} className="text-muted-foreground">No visitor records yet.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <TablePagination
        page={page}
        totalPages={totalPages}
        totalItems={visitors.length}
        pageSize={pageSize}
        onPageChange={setPage}
      />
    </Card>
  );
}

function PaginatedActivityList({activity, onRemove}: { activity: RecentActivity[]; onRemove: (id: number) => Promise<void> }) {
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(activity.length / pageSize));
  const displayed = activity.slice((page - 1) * pageSize, page * pageSize);

  return (
    <Card>
      <div className="shadow-scroll-container">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Page</TableHead>
              <TableHead>Node / IP</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>System</TableHead>
              <TableHead>Visit Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayed.length ? displayed.map(a => (
              <TableRow key={a.id}>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(a.viewed_at).toLocaleTimeString([], {hour: "2-digit", minute: "2-digit", second: "2-digit"})}
                </TableCell>
                <TableCell className="font-mono text-xs max-w-[180px] truncate">{a.path}</TableCell>
                <TableCell className="font-mono text-xs">{a.ip_address}</TableCell>
                <TableCell className="text-xs whitespace-nowrap">{a.location || "—"}</TableCell>
                <TableCell className="text-xs">{a.os} · {a.browser}</TableCell>
                <TableCell className="space-x-1.5 whitespace-nowrap">
                  {a.is_returning ? (
                    <Badge className="bg-emerald-600 text-white text-[11px] py-0">
                      Returning (#{a.visit_number})
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[11px] py-0 text-muted-foreground">
                      New
                    </Badge>
                  )}
                  {Boolean(a.is_page_repeat) && (
                    <Badge variant="secondary" className="text-[11px] py-0 bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                      Page Repeat
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                    onClick={() => void onRemove(a.id)}
                  >
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={7} className="text-muted-foreground">No activity recorded yet.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <TablePagination
        page={page}
        totalPages={totalPages}
        totalItems={activity.length}
        pageSize={pageSize}
        onPageChange={setPage}
      />
    </Card>
  );
}

function TablePagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (next: number) => void;
}) {
  if (totalItems <= pageSize) return null;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);

  return (
    <div className="flex items-center justify-between border-t px-4 py-2.5 text-xs text-muted-foreground">
      <span>
        Showing {start}-{end} of {totalItems}
      </span>
      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2 text-xs"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="size-3 mr-0.5"/> Prev
        </Button>
        <span className="px-1 text-xs">
          Page {page} of {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2 text-xs"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next <ChevronRight className="size-3 ml-0.5"/>
        </Button>
      </div>
    </div>
  );
}

function SubscriberList({subscribers, onRemove}: { subscribers: Subscriber[]; onRemove: (id: number) => Promise<void> }) {
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(subscribers.length / pageSize));
  const displayed = subscribers.slice((page - 1) * pageSize, page * pageSize);

  return (
    <Card>
      <div className="shadow-scroll-container">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Subscribed</TableHead>
              <TableHead/>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayed.length ? displayed.map(sub => (
              <TableRow key={sub.id}>
                <TableCell className="font-medium">{sub.email}</TableCell>
                <TableCell>{new Date(sub.subscribed_at).toLocaleDateString()}</TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => void onRemove(sub.id)}
                  >
                    Remove
                  </Button>
                </TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={3} className="text-muted-foreground">No subscribers yet.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <TablePagination
        page={page}
        totalPages={totalPages}
        totalItems={subscribers.length}
        pageSize={pageSize}
        onPageChange={setPage}
      />
    </Card>
  );
}
