// src/app/(manager)/dev/ui/page.tsx
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Kbd } from "@/components/ui/kbd";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { StatusDot } from "@/components/ui/status-dot";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export const dynamic = "force-dynamic";

/**
 * Development-only gallery: every primitive once, on Kademe tokens, so a token
 * change can be judged on one screen. Not linked from the menu; 404 in production.
 * Copy is English on purpose: this page is for developers, not users.
 */
export default function UiGalleryPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <TooltipProvider>
      <main className="mx-auto max-w-[1360px] px-page py-8">
        <h1 className="text-[26px] font-semibold text-ink">UI primitives</h1>
        <div className="mt-section grid gap-section lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Buttons</CardTitle>
              <CardDescription>One filled button per screen.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-3">
              <Button variant="primary">Primary</Button>
              <Button>Secondary</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="danger">Danger</Button>
              <Button size="icon-sm" aria-label="Icon">+</Button>
              <Spinner />
              <Kbd>⌘K</Kbd>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Fields</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-field">
              <div className="grid gap-2">
                <Label htmlFor="g-name">Name</Label>
                <Input id="g-name" placeholder="Deniz Aydın" />
              </div>
              <Textarea placeholder="Notes" />
              <Select>
                <SelectTrigger className="w-60">
                  <SelectValue placeholder="Choose a level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="b1">B1</SelectItem>
                  <SelectItem value="b2">B2</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-sm"><Checkbox /> Checkbox</label>
                <label className="flex items-center gap-2 text-sm"><Switch /> Switch</label>
              </div>
              <RadioGroup defaultValue="a" className="flex gap-6">
                <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="a" /> A</label>
                <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="b" /> B</label>
              </RadioGroup>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Overlays</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Dialog>
                <DialogTrigger asChild><Button>Dialog</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Dialog</DialogTitle>
                    <DialogDescription>Never an &quot;are you sure&quot;.</DialogDescription>
                  </DialogHeader>
                </DialogContent>
              </Dialog>
              <Sheet>
                <SheetTrigger asChild><Button>Sheet</Button></SheetTrigger>
                <SheetContent>
                  <SheetHeader><SheetTitle>Sheet</SheetTitle></SheetHeader>
                </SheetContent>
              </Sheet>
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button>Menu</Button></DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem>Candidate</DropdownMenuItem>
                  <DropdownMenuItem>Student</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Popover>
                <PopoverTrigger asChild><Button>Popover</Button></PopoverTrigger>
                <PopoverContent>Popover body</PopoverContent>
              </Popover>
              <Tooltip>
                <TooltipTrigger asChild><Button>Tooltip</Button></TooltipTrigger>
                <TooltipContent>Icon labels only</TooltipContent>
              </Tooltip>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Lists</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="one">
                <TabsList>
                  <TabsTrigger value="one">One</TabsTrigger>
                  <TabsTrigger value="two">Two</TabsTrigger>
                </TabsList>
                <TabsContent value="one">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell>Ayşe Demir</TableCell>
                        <TableCell><StatusDot tone="done">Finalized</StatusDot></TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TabsContent>
                <TabsContent value="two">
                  <Skeleton className="h-row w-full" />
                </TabsContent>
              </Tabs>
              <Separator className="my-4" />
              <p className="text-sm text-muted-foreground">muted-foreground text</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Form fields</CardTitle>
              <CardDescription>Field, input group and the 40px control height.</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="g-email">Email</FieldLabel>
                  <Input id="g-email" type="email" placeholder="deniz@example.com" />
                  <FieldDescription>Used only for the invitation.</FieldDescription>
                </Field>
                <Field data-invalid="true">
                  <FieldLabel htmlFor="g-code">Code</FieldLabel>
                  <Input id="g-code" aria-invalid="true" defaultValue="12" />
                  <FieldError>The code has six digits.</FieldError>
                </Field>
                <Field>
                  <FieldLabel htmlFor="g-search">Search</FieldLabel>
                  <InputGroup>
                    <InputGroupInput id="g-search" placeholder="Candidate or opening" />
                    <InputGroupAddon align="inline-end">
                      <InputGroupButton size="sm">Search</InputGroupButton>
                    </InputGroupAddon>
                  </InputGroup>
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Navigation</CardTitle>
              <CardDescription>A static sidebar and the command list.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="h-64 overflow-hidden rounded-xl border">
                <SidebarProvider className="min-h-0">
                  <Sidebar collapsible="none">
                    <SidebarContent>
                      <SidebarGroup>
                        <SidebarGroupLabel>Hiring</SidebarGroupLabel>
                        <SidebarMenu>
                          <SidebarMenuItem>
                            <SidebarMenuButton isActive>Candidates</SidebarMenuButton>
                          </SidebarMenuItem>
                          <SidebarMenuItem>
                            <SidebarMenuButton>Openings</SidebarMenuButton>
                          </SidebarMenuItem>
                        </SidebarMenu>
                      </SidebarGroup>
                      <SidebarGroup>
                        <SidebarGroupLabel>Exam</SidebarGroupLabel>
                        <SidebarMenu>
                          <SidebarMenuItem>
                            <SidebarMenuButton>Students</SidebarMenuButton>
                          </SidebarMenuItem>
                        </SidebarMenu>
                      </SidebarGroup>
                    </SidebarContent>
                  </Sidebar>
                </SidebarProvider>
              </div>
              <Command className="h-64 border">
                <CommandInput placeholder="Search people, openings" />
                <CommandList>
                  <CommandEmpty>No match.</CommandEmpty>
                  <CommandGroup heading="Actions">
                    <CommandItem>
                      Invite a candidate
                      <CommandShortcut>⌘I</CommandShortcut>
                    </CommandItem>
                    <CommandItem>Invite a student</CommandItem>
                  </CommandGroup>
                </CommandList>
              </Command>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Empty and collapsible</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <Empty className="border">
                <EmptyHeader>
                  <EmptyTitle>No candidates yet</EmptyTitle>
                  <EmptyDescription>Invite the first one; the list fills as they finish.</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button variant="primary">Invite a candidate</Button>
                </EmptyContent>
              </Empty>
              <Collapsible className="rounded-lg border p-3">
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm">Show the rubric</Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 text-sm text-muted-foreground">
                  Anchors for 1 to 5, one line each.
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
          </Card>
        </div>
      </main>
    </TooltipProvider>
  );
}
