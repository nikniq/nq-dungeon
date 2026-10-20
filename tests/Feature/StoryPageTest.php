<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StoryPageTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_story_page_is_public_and_tells_both_stories(): void
    {
        $this->get('/world/story')->assertOk()
            ->assertSee('Story 1: The Shattered Crown')->assertSee('Story 2: The Far Shore')
            ->assertSee('Act II: What Sleeps Below')->assertSee('Tsardom of Severin')->assertSee('Story 3: The Frozen Gate')->assertSee('Midgard')->assertSee('Story 4: The Long Night')->assertSee('Rift Lord')
            ->assertSee('Log in')->assertDontSee('<textarea', false);
        $this->get('/')->assertOk()->assertSee('/world/story');
    }

    public function test_only_signed_in_heroes_can_post_and_posts_show_the_hero_name(): void
    {
        $this->post('/world/story', ['story' => 1, 'body' => 'Loved the prince twist'])->assertRedirect('/login');

        $user = User::factory()->create();
        $user->character()->create(['name' => 'Ayla', 'class' => 'ranger']);
        $this->actingAs($user)->post('/world/story', ['story' => 2, 'body' => "  The   bear\nis the best character  "])->assertRedirect();
        $this->assertDatabaseHas('story_posts', ['user_id' => $user->id, 'story' => 2, 'body' => 'The bear is the best character']);
        $this->get('/world/story')->assertOk()->assertSee('Ayla')->assertSee('The bear is the best character');

        $this->actingAs($user)->post('/world/story', ['story' => 3, 'body' => 'Thrym was hard'])->assertRedirect();
        $this->actingAs($user)->post('/world/story', ['story' => 4, 'body' => 'Hearth burned twice'])->assertRedirect();
        $this->actingAs($user)->post('/world/story', ['story' => 9, 'body' => 'x'])->assertSessionHasErrors(['story', 'body']);
        $this->actingAs($user)->post('/world/story', ['story' => 1, 'body' => str_repeat('a', 601)])->assertSessionHasErrors('body');
    }
}
