<?php

namespace App\Http\Controllers;

use App\Models\Character;
use App\Models\StoryPost;
use App\Models\TownBuilding;
use App\Models\TownProject;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

/**
 * The admin section: who plays, what they have built and said, and the levers
 * to fix a hero, moderate a post or remove a structure. Reached only with the
 * admin flag (see the admin:grant command).
 */
class AdminController extends Controller
{
    public function index(): View
    {
        return view('admin.index', ['stats' => [
            'Users' => User::count(), 'Admins' => User::where('is_admin', true)->count(), 'Heroes' => Character::count(),
            'Heroes active this week' => Character::where('updated_at', '>=', now()->subWeek())->count(),
            'Highest level' => (int) Character::max('level'), 'Gold in circulation' => (int) Character::sum('gold'),
            'Monuments' => TownBuilding::count(), 'Rebuilding projects' => TownProject::count(), 'Story posts' => StoryPost::count(),
        ], 'recent' => Character::with('user')->orderByDesc('updated_at')->limit(8)->get()]);
    }

    public function users(Request $request): View
    {
        $q = trim((string) $request->query('q', ''));
        $users = User::withCount(['storyPosts'])->with('character')
            ->when($q !== '', fn ($query) => $query->where(fn ($w) => $w->where('name', 'like', "%$q%")->orWhere('email', 'like', "%$q%")))
            ->orderByDesc('id')->paginate(25)->withQueryString();

        return view('admin.users', ['users' => $users, 'q' => $q]);
    }

    public function toggleAdmin(Request $request, User $user): RedirectResponse
    {
        abort_if($user->id === $request->user()->id, 422, 'You cannot change your own flag.');
        $user->update(['is_admin' => ! $user->is_admin]);

        return back()->with('status', ($user->is_admin ? 'Granted admin to ' : 'Revoked admin from ').$user->email.'.');
    }

    public function destroyUser(Request $request, User $user): RedirectResponse
    {
        abort_if($user->id === $request->user()->id, 422, 'You cannot delete yourself.');
        $user->delete();

        return redirect()->route('admin.users')->with('status', 'Deleted '.$user->email.' and their hero.');
    }

    public function heroes(Request $request): View
    {
        $q = trim((string) $request->query('q', ''));
        $heroes = Character::with('user')->when($q !== '', fn ($query) => $query->where('name', 'like', "%$q%"))
            ->orderByDesc('updated_at')->paginate(25)->withQueryString();

        return view('admin.heroes', ['heroes' => $heroes, 'q' => $q]);
    }

    public function updateHero(Request $request, Character $character): RedirectResponse
    {
        $data = $request->validate(['gold' => ['required', 'integer', 'min:0', 'max:100000000'], 'level' => ['required', 'integer', 'min:1', 'max:999'], 'name' => ['required', 'string', 'min:2', 'max:24']]);
        $character->update($data);

        return back()->with('status', 'Updated '.$character->name.'.');
    }

    public function resetHero(Character $character): RedirectResponse
    {
        $character->update(['floor' => 0, 'hp' => $character->max_hp]);

        return back()->with('status', $character->name.' is back in town at full health.');
    }

    public function posts(): View
    {
        return view('admin.posts', ['posts' => StoryPost::with('user.character')->latest()->paginate(30)]);
    }

    public function destroyPost(StoryPost $post): RedirectResponse
    {
        $post->delete();

        return back()->with('status', 'Post removed.');
    }

    public function structures(): View
    {
        return view('admin.structures', ['projects' => TownProject::latest()->paginate(30, ['*'], 'projects'), 'buildings' => TownBuilding::latest()->paginate(30, ['*'], 'buildings')]);
    }

    public function destroyProject(TownProject $project): RedirectResponse
    {
        $project->delete();

        return back()->with('status', 'Structure removed; it will vanish from the world when players next load the town.');
    }

    public function destroyBuilding(TownBuilding $building): RedirectResponse
    {
        $building->delete();

        return back()->with('status', 'Monument removed.');
    }
}
