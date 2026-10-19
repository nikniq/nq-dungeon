<?php

namespace App\Http\Controllers;

use App\Models\StoryPost;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

// The public story page: the game's narrative in stories and acts, with a
// discussion thread under each that signed-in heroes can post to.
class StoryController extends Controller
{
    public function index(): View
    {
        $posts = StoryPost::with('user.character')->latest()->limit(200)->get()->groupBy('story');

        return view('story', ['stories' => config('story'), 'posts' => $posts]);
    }

    public function post(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'story' => ['required', 'integer', 'between:1,'.count(config('story'))],
            'body' => ['required', 'string', 'min:2', 'max:600'],
        ]);
        $request->user()->storyPosts()->create(['story' => $data['story'], 'body' => trim(preg_replace('/\s+/u', ' ', $data['body']))]);

        return redirect()->route('world.story', ['#story-'.$data['story']])->with('status', 'Posted.');
    }
}
