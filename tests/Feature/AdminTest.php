<?php

namespace Tests\Feature;

use App\Models\StoryPost;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminTest extends TestCase
{
    use RefreshDatabase;

    public function test_only_admins_reach_the_admin_section(): void
    {
        $this->get('/admin')->assertRedirect('/login');
        $user = User::factory()->create();
        $this->actingAs($user)->get('/admin')->assertForbidden();
        $this->actingAs($user)->get('/')->assertOk()->assertDontSee('/admin"', false);

        $admin = User::factory()->create(['is_admin' => true]);
        $admin->character()->create(['name' => 'Warden', 'class' => 'warrior', 'gold' => 10]);
        $this->actingAs($admin)->get('/')->assertOk()->assertSee('/admin"', false)->assertDontSee('>Profile<', false);
        $this->actingAs($admin)->get('/admin')->assertOk()->assertSee('Admin overview')->assertSee('Heroes');
        $this->actingAs($admin)->get('/admin/users')->assertOk()->assertSee($user->email);
        $this->actingAs($admin)->get('/admin/heroes')->assertOk()->assertSee('Warden');
        $this->actingAs($admin)->get('/admin/structures')->assertOk()->assertSee('Rebuilding projects');
    }

    public function test_admins_can_moderate_and_manage(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);
        $user = User::factory()->create();
        $hero = $user->character()->create(['name' => 'Ayla', 'class' => 'ranger', 'gold' => 5, 'level' => 3, 'floor' => 4, 'hp' => 2, 'max_hp' => 30]);
        $post = StoryPost::create(['user_id' => $user->id, 'story' => 1, 'body' => 'spam spam spam']);

        $this->actingAs($admin)->get('/admin/posts')->assertOk()->assertSee('spam spam spam');
        $this->actingAs($admin)->delete("/admin/posts/{$post->id}")->assertRedirect();
        $this->assertDatabaseMissing('story_posts', ['id' => $post->id]);

        $this->actingAs($admin)->post("/admin/heroes/{$hero->name}", ['name' => 'Ayla', 'gold' => 900, 'level' => 12])->assertRedirect();
        $this->assertSame([900, 12], [$hero->fresh()->gold, $hero->fresh()->level]);
        $this->actingAs($admin)->post("/admin/heroes/{$hero->name}/reset")->assertRedirect();
        $this->assertSame([0, 30], [$hero->fresh()->floor, $hero->fresh()->hp]);

        $this->actingAs($admin)->post("/admin/users/{$user->id}/admin")->assertRedirect();
        $this->assertTrue($user->fresh()->is_admin);
        $this->actingAs($admin)->post("/admin/users/{$admin->id}/admin")->assertStatus(422);
        $this->actingAs($admin)->delete("/admin/users/{$user->id}")->assertRedirect('/admin/users');
        $this->assertDatabaseMissing('users', ['id' => $user->id]);
        $this->assertDatabaseMissing('characters', ['id' => $hero->id]);

        $this->artisan('admin:grant', ['email' => $admin->email, '--revoke' => true])->assertSuccessful();
        $this->assertFalse($admin->fresh()->is_admin);
        $this->artisan('admin:grant', ['email' => 'nobody@example.com'])->assertFailed();
    }
}
