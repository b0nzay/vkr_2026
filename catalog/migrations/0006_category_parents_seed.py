from django.db import migrations


def set_category_parents(apps, schema_editor):
    Category = apps.get_model("catalog", "Category")

    parent = Category.objects.filter(name="Бамперы").first()
    if not parent:
        return

    Category.objects.filter(
        name="Передний бампер",
        parent__isnull=True,
    ).update(parent=parent)


class Migration(migrations.Migration):
    dependencies = [
        ("catalog", "0005_category_parent"),
    ]

    operations = [
        migrations.RunPython(set_category_parents, migrations.RunPython.noop),
    ]

